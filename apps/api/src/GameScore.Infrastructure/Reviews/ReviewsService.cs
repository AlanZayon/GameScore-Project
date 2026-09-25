using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Application.Http;
using GameScore.Infrastructure.Auth;
using GameScore.Infrastructure.Crypto;
using GameScore.Infrastructure.Integrations;
using GameScore.Infrastructure.Jobs;
using GameScore.Infrastructure.Mappers;
using GameScore.Infrastructure.Persistence;
using GameScore.Infrastructure.Ratings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Reviews;

public sealed class ReviewsService
{
    private readonly GameScoreDbContext _db;
    private readonly ReviewDataAccess _reviews;
    private readonly AntiSpamService _antiSpam;
    private readonly ReviewRankingService _ranking;
    private readonly ReputationService _reputation;
    private readonly ScoreRecalculationService _scores;
    private readonly GameImportService _importer;
    private readonly BackgroundJobScheduler _jobs;
    private readonly AppConfig _config;

    public ReviewsService(
        GameScoreDbContext db,
        ReviewDataAccess reviews,
        AntiSpamService antiSpam,
        ReviewRankingService ranking,
        ReputationService reputation,
        ScoreRecalculationService scores,
        GameImportService importer,
        BackgroundJobScheduler jobs,
        IOptions<AppConfig> config)
    {
        _db = db;
        _reviews = reviews;
        _antiSpam = antiSpam;
        _ranking = ranking;
        _reputation = reputation;
        _scores = scores;
        _importer = importer;
        _jobs = jobs;
        _config = config.Value;
    }

    public async Task<object> ListForGameSlugAsync(
        string slug,
        string sort,
        string recommendation,
        Guid? platformId,
        int? minHours,
        int? maxHours,
        string? cursor,
        int? limit,
        Guid? viewerId,
        CancellationToken cancellationToken = default)
    {
        var game = await _db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Slug == slug, cancellationToken);
        if (game is null)
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        var pageSize = Pagination.ClampLimit(limit, Pagination.DefaultCursorSize);
        var (items, nextCursor) = await _reviews.ListForGameAsync(
            game.Id,
            sort,
            recommendation,
            platformId,
            minHours,
            maxHours,
            cursor,
            pageSize,
            cancellationToken);

        return new
        {
            items = await MapManyAsync(items, viewerId, cancellationToken),
            meta = Pagination.CursorMeta(pageSize, nextCursor),
        };
    }

    public async Task<object> GetByIdAsync(Guid id, Guid? viewerId, CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadAsync(id, cancellationToken);
        if (bundle is null || bundle.Review.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        return (await MapManyAsync([bundle], viewerId, cancellationToken))[0];
    }

    public Task<object> CreateAsync(
        string slug,
        Guid userId,
        int reputationScore,
        bool recommended,
        int? rating,
        string text,
        int? hoursPlayed,
        Guid? platformId,
        string? clientIp,
        CancellationToken cancellationToken = default) =>
        CreateInternalAsync(slug, null, userId, reputationScore, recommended, rating, text, hoursPlayed, platformId, clientIp, cancellationToken);

    public async Task<object> CreateForExternalAsync(
        string externalId,
        Guid userId,
        int reputationScore,
        bool recommended,
        int? rating,
        string text,
        int? hoursPlayed,
        Guid? platformId,
        string? clientIp,
        CancellationToken cancellationToken = default)
    {
        var imported = await _importer.ImportByExternalIdAsync(externalId, cancellationToken);
        var resolvedPlatform = await ResolvePlatformRefAsync(imported.GameId, platformId, cancellationToken);
        return await CreateInternalAsync(
            imported.Slug,
            imported.GameId,
            userId,
            reputationScore,
            recommended,
            rating,
            text,
            hoursPlayed,
            resolvedPlatform,
            clientIp,
            cancellationToken);
    }

    public async Task<object> UpdateAsync(
        Guid id,
        Guid userId,
        int reputationScore,
        bool? recommended,
        int? rating,
        string? text,
        int? hoursPlayed,
        Guid? platformId,
        CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadTrackedAsync(id, cancellationToken);
        if (bundle is null || bundle.Review.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        if (bundle.Review.UserId != userId)
        {
            throw new ForbiddenException(ErrorCodes.ReviewNotOwned, "You can only edit your own reviews");
        }

        var review = bundle.Review;
        var nextRecommended = recommended ?? review.Recommended;
        var nextText = text?.Trim() ?? review.Text;
        AssertPayload(nextRecommended, nextText, rating ?? review.Rating, hoursPlayed ?? review.HoursPlayed);

        if (platformId is not null)
        {
            await ResolvePlatformRefAsync(review.GameId, platformId, cancellationToken);
            review.PlatformId = platformId;
        }

        var fingerprint = HashUtil.ReviewFingerprint(nextText);
        var moderation = await _antiSpam.InspectAsync(
            new AntiSpamInput(userId, nextText, fingerprint, review.AuthorIpHash, SkipRateLimits: true, ExcludeReviewId: review.Id),
            cancellationToken);

        var rankingScore = _ranking.Score(
            review.UsefulCount,
            review.NotUsefulCount,
            reputationScore,
            nextText.Length,
            hoursPlayed ?? review.HoursPlayed,
            rating ?? review.Rating,
            review.CreatedAt);

        var previousRecommended = review.Recommended;
        review.Recommended = nextRecommended;
        review.Text = nextText;
        if (rating is not null)
        {
            review.Rating = rating;
        }

        if (hoursPlayed is not null)
        {
            review.HoursPlayed = hoursPlayed;
        }

        review.Edited = true;
        review.TextFingerprint = fingerprint;
        review.ModerationStatus = moderation;
        review.RankingScore = rankingScore;
        review.UpdatedAt = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (previousRecommended != nextRecommended)
        {
            await _scores.BumpDailyActivityAsync(review.GameId, previousRecommended, review.CreatedAt, -1, cancellationToken);
            await _scores.BumpDailyActivityAsync(review.GameId, nextRecommended, review.CreatedAt, 1, cancellationToken);
        }

        await _scores.RecalculateInsideAsync(review.GameId, includePlatforms: true, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _jobs.EnqueueRecalculateGameScore(review.GameId);
        _jobs.EnqueueInvalidateRankings();
        await _reputation.InvalidateUserStatsAsync(userId, cancellationToken);

        return (await MapManyAsync([await _reviews.LoadAsync(id, cancellationToken)!], userId, cancellationToken))[0];
    }

    public async Task SoftDeleteAsync(Guid id, Guid userId, string? reason, CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadTrackedAsync(id, cancellationToken);
        if (bundle is null || bundle.Review.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        if (bundle.Review.UserId != userId)
        {
            throw new ForbiddenException(ErrorCodes.ReviewNotOwned, "You can only delete your own reviews");
        }

        var review = bundle.Review;
        review.DeletedAt = DateTime.UtcNow;
        review.DeletedById = userId;
        review.DeletionReason = reason ?? "Deleted by author";
        review.Status = DbReviewStatus.HIDDEN;
        review.UpdatedAt = DateTime.UtcNow;

        var author = await _db.Users.FirstAsync(u => u.Id == review.UserId, cancellationToken);
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        _reputation.ApplyToUser(author, "REVIEW_DELETED", "review", review.Id);
        await _scores.BumpDailyActivityAsync(review.GameId, review.Recommended, review.CreatedAt, -1, cancellationToken);
        await _scores.RecalculateInsideAsync(review.GameId, true, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _jobs.EnqueueRecalculateGameScore(review.GameId);
        _jobs.EnqueueInvalidateRankings();
        await _reputation.InvalidateUserStatsAsync(review.UserId, cancellationToken);
    }

    public async Task<object> VoteAsync(Guid id, bool useful, Guid voterId, CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadTrackedAsync(id, cancellationToken);
        if (bundle is null || bundle.Review.DeletedAt is not null || bundle.Review.Status != DbReviewStatus.PUBLISHED)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        if (bundle.Review.UserId == voterId)
        {
            throw new ForbiddenException(ErrorCodes.CannotVoteOwnReview, "You cannot vote on your own review");
        }

        var review = bundle.Review;
        var author = await _db.Users.FirstAsync(u => u.Id == review.UserId, cancellationToken);
        var existing = await _db.ReviewVotes.FirstOrDefaultAsync(v => v.ReviewId == id && v.UserId == voterId, cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (existing?.Useful == useful)
        {
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return VoteResponse(review, useful);
        }

        if (existing is not null)
        {
            existing.Useful = useful;
            existing.UpdatedAt = DateTime.UtcNow;
            _reputation.ApplyToUser(author, existing.Useful ? "USEFUL_VOTE_REMOVED" : "NOT_USEFUL_VOTE_REMOVED", "review", id);
            _reputation.ApplyToUser(author, useful ? "USEFUL_VOTE_RECEIVED" : "NOT_USEFUL_VOTE_RECEIVED", "review", id);
            review.UsefulCount = Math.Max(0, review.UsefulCount + (useful ? 1 : -1));
            review.NotUsefulCount = Math.Max(0, review.NotUsefulCount + (useful ? -1 : 1));
        }
        else
        {
            _db.ReviewVotes.Add(new ReviewVoteEntity
            {
                Id = Guid.NewGuid(),
                ReviewId = id,
                UserId = voterId,
                Useful = useful,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            _reputation.ApplyToUser(author, useful ? "USEFUL_VOTE_RECEIVED" : "NOT_USEFUL_VOTE_RECEIVED", "review", id);
            if (useful)
            {
                review.UsefulCount++;
            }
            else
            {
                review.NotUsefulCount++;
            }
        }

        review.RankingScore = _ranking.Score(
            review.UsefulCount,
            review.NotUsefulCount,
            author.ReputationScore,
            review.Text.Length,
            review.HoursPlayed,
            review.Rating,
            review.CreatedAt);
        review.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        await _reputation.InvalidateUserStatsAsync(review.UserId, cancellationToken);
        return VoteResponse(review, useful);
    }

    public async Task<object> RemoveVoteAsync(Guid id, Guid voterId, CancellationToken cancellationToken = default)
    {
        var existing = await _db.ReviewVotes.FirstOrDefaultAsync(v => v.ReviewId == id && v.UserId == voterId, cancellationToken);
        if (existing is null)
        {
            throw new NotFoundException(ErrorCodes.VoteNotFound, "You have not voted on this review");
        }

        var review = await _db.Reviews.FirstAsync(r => r.Id == id, cancellationToken);
        var author = await _db.Users.FirstAsync(u => u.Id == review.UserId, cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        _db.ReviewVotes.Remove(existing);
        _reputation.ApplyToUser(author, existing.Useful ? "USEFUL_VOTE_REMOVED" : "NOT_USEFUL_VOTE_REMOVED", "review", id);
        if (existing.Useful)
        {
            review.UsefulCount = Math.Max(0, review.UsefulCount - 1);
        }
        else
        {
            review.NotUsefulCount = Math.Max(0, review.NotUsefulCount - 1);
        }

        review.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        await _reputation.InvalidateUserStatsAsync(review.UserId, cancellationToken);

        return new
        {
            reviewId = id,
            usefulCount = review.UsefulCount,
            notUsefulCount = review.NotUsefulCount,
            viewerVote = (string?)null,
        };
    }

    public async Task ReportAsync(
        Guid id,
        Guid reporterId,
        string reason,
        string? details,
        CancellationToken cancellationToken = default)
    {
        var review = await _db.Reviews.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (review is null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        if (review.UserId == reporterId)
        {
            throw new ForbiddenException(ErrorCodes.CannotReportOwnReview, "You cannot report your own review");
        }

        if (await _db.ReviewReports.AnyAsync(r => r.ReviewId == id && r.ReporterId == reporterId, cancellationToken))
        {
            throw new ConflictException(ErrorCodes.ReviewAlreadyReported, "You have already reported this review");
        }

        _db.ReviewReports.Add(new ReviewReportEntity
        {
            Id = Guid.NewGuid(),
            ReviewId = id,
            ReporterId = reporterId,
            Reason = Enum.Parse<DbReportReason>(reason),
            Details = details,
            Status = DbReportStatus.PENDING,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<object> CreateInternalAsync(
        string slug,
        Guid? gameId,
        Guid userId,
        int reputationScore,
        bool recommended,
        int? rating,
        string text,
        int? hoursPlayed,
        Guid? platformId,
        string? clientIp,
        CancellationToken cancellationToken)
    {
        gameId ??= (await _db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Slug == slug, cancellationToken))?.Id;
        if (gameId is null)
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        if (await _db.Reviews.AnyAsync(r => r.UserId == userId && r.GameId == gameId && r.DeletedAt == null, cancellationToken))
        {
            throw new ConflictException(ErrorCodes.ReviewAlreadyExists, "You already have a review for this game");
        }

        platformId = await ResolvePlatformRefAsync(gameId.Value, platformId, cancellationToken);
        AssertPayload(recommended, text, rating, hoursPlayed);

        var fingerprint = HashUtil.ReviewFingerprint(text);
        var ipHash = HashUtil.HashClientIp(clientIp, _config.Jwt.AccessSecret);
        var moderation = await _antiSpam.InspectAsync(
            new AntiSpamInput(userId, text, fingerprint, ipHash),
            cancellationToken);

        var now = DateTime.UtcNow;
        var rankingScore = _ranking.Score(0, 0, reputationScore, text.Trim().Length, hoursPlayed, rating, now);
        var review = new ReviewEntity
        {
            Id = Guid.NewGuid(),
            GameId = gameId.Value,
            UserId = userId,
            Recommended = recommended,
            Rating = rating,
            Text = text.Trim(),
            HoursPlayed = hoursPlayed,
            PlatformId = platformId,
            RankingScore = rankingScore,
            ModerationStatus = moderation,
            TextFingerprint = fingerprint,
            AuthorIpHash = ipHash,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _db.Reviews.Add(review);
        var author = await _db.Users.FirstAsync(u => u.Id == userId, cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        _reputation.ApplyToUser(author, "REVIEW_PUBLISHED", "review", review.Id);
        await _scores.BumpDailyActivityAsync(gameId.Value, recommended, now, 1, cancellationToken);
        await _scores.RecalculateInsideAsync(gameId.Value, true, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _jobs.EnqueueDetectReviewBomb(gameId.Value, DateHelpers.IsoDate(now));
        _jobs.EnqueueRecalculateGameScore(gameId.Value);
        _jobs.EnqueueInvalidateRankings();
        await _reputation.InvalidateUserStatsAsync(userId, cancellationToken);

        var bundle = await _reviews.LoadAsync(review.Id, cancellationToken);
        return (await MapManyAsync([bundle!], userId, cancellationToken))[0];
    }

    private static object VoteResponse(ReviewEntity review, bool useful) =>
        new
        {
            reviewId = review.Id,
            usefulCount = review.UsefulCount,
            notUsefulCount = review.NotUsefulCount,
            viewerVote = useful ? "USEFUL" : "NOT_USEFUL",
        };

    private async Task<IReadOnlyList<object>> MapManyAsync(
        IReadOnlyList<ReviewBundle> items,
        Guid? viewerId,
        CancellationToken cancellationToken)
    {
        var ids = items.Select(i => i.Review.Id).ToList();
        var context = viewerId is null
            ? (Votes: new Dictionary<Guid, bool>(), Reports: new HashSet<Guid>())
            : await _reviews.ViewerContextAsync(ids, viewerId.Value, cancellationToken);

        return items.Select(item =>
        {
            bool? viewerVote = null;
            if (viewerId is not null && context.Votes.TryGetValue(item.Review.Id, out var vote))
            {
                viewerVote = vote;
            }

            return ReviewMapper.ToDto(
                item.Review,
                item.Author,
                item.Game,
                item.Platform,
                viewerId,
                viewerVote,
                context.Reports.Contains(item.Review.Id));
        }).ToList();
    }

    private async Task<Guid?> ResolvePlatformRefAsync(Guid gameId, Guid? platformRef, CancellationToken cancellationToken)
    {
        if (platformRef is null)
        {
            return null;
        }

        var link = await _db.GamePlatforms.AsNoTracking()
            .Include(gp => gp.Platform)
            .FirstOrDefaultAsync(
                gp => gp.GameId == gameId && (gp.PlatformId == platformRef || gp.Platform.Slug == platformRef.ToString()),
                cancellationToken);

        if (link is null)
        {
            var bySlug = await _db.GamePlatforms.AsNoTracking()
                .Include(gp => gp.Platform)
                .FirstOrDefaultAsync(gp => gp.GameId == gameId && gp.Platform.Slug == platformRef.ToString(), cancellationToken);
            link = bySlug;
        }

        if (link is null)
        {
            throw new BadRequestException(
                ErrorCodes.PlatformNotAvailableForGame,
                "That platform is not listed for this game");
        }

        return link.PlatformId;
    }

    private static void AssertPayload(bool recommended, string text, int? rating, int? hoursPlayed)
    {
        if (rating is < 0 or > 10)
        {
            throw new BadRequestException(ErrorCodes.ValidationFailed, "Rating must be between 0 and 10");
        }

        if (hoursPlayed is < 0 or > 100_000)
        {
            throw new BadRequestException(ErrorCodes.ValidationFailed, "Hours played is out of range");
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            throw new BadRequestException(ErrorCodes.ValidationFailed, "Review text is required");
        }
    }
}
