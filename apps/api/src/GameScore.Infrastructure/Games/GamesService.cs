using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Application.Http;
using GameScore.Domain.Scoring;
using GameScore.Infrastructure.Jobs;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Games;

public sealed class GamesService
{
    private readonly GameScoreDbContext _db;
    private readonly AppConfig _config;
    private readonly BackgroundJobScheduler _jobs;

    public GamesService(GameScoreDbContext db, IOptions<AppConfig> config, BackgroundJobScheduler jobs)
    {
        _db = db;
        _config = config.Value;
        _jobs = jobs;
    }

    public async Task<object> ListAsync(
        int page,
        int limit,
        string? platform,
        string? genre,
        string sort,
        CancellationToken cancellationToken = default)
    {
        page = Pagination.ClampPage(page);
        limit = Pagination.ClampLimit(limit);
        var query = _db.Games.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(platform))
        {
            query = query.Where(g => g.Platforms.Any(gp => gp.Platform.Slug == platform));
        }

        if (!string.IsNullOrWhiteSpace(genre))
        {
            query = query.Where(g => g.Genres.Any(gg => gg.Genre.Slug == genre));
        }

        query = sort switch
        {
            "NAME" => query.OrderBy(g => g.Name),
            "RECENT" => query.OrderByDescending(g => g.CreatedAt),
            "TOP_RATED" => query.OrderByDescending(g => g.Statistics!.ConfidenceScore),
            _ => query.OrderByDescending(g => g.Statistics!.TotalReviews).ThenByDescending(g => g.ViewCount),
        };

        var total = await query.CountAsync(cancellationToken);
        var games = await query
            .Include(g => g.Statistics)
            .Include(g => g.Platforms).ThenInclude(gp => gp.Platform)
            .Include(g => g.Genres).ThenInclude(gg => gg.Genre)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var items = games
            .Select(g => GameDtoMapper.ToSummary(g, _config.Ranking.ScoreLabelMinimumReviews))
            .Cast<object>()
            .ToList();

        return Pagination.Paginated(items, total, page, limit);
    }

    public async Task<object> GetBySlugAsync(string slug, Guid? viewerId, CancellationToken cancellationToken = default)
    {
        var game = await _db.Games
            .AsNoTracking()
            .Include(g => g.Statistics)
            .Include(g => g.Platforms).ThenInclude(gp => gp.Platform)
            .Include(g => g.Genres).ThenInclude(gg => gg.Genre)
            .Include(g => g.ExternalSources)
            .FirstOrDefaultAsync(g => g.Slug == slug, cancellationToken);

        if (game is null)
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        Guid? viewerReviewId = null;
        if (viewerId is not null)
        {
            viewerReviewId = await _db.Reviews
                .Where(r => r.GameId == game.Id && r.UserId == viewerId && r.DeletedAt == null)
                .Select(r => (Guid?)r.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var hasReviewBombEvents = await _db.ReviewBombEvents.AnyAsync(
            e => e.GameId == game.Id && e.Status != DbReviewBombStatus.DISMISSED,
            cancellationToken);

        var relations = await _db.GameRelations.AsNoTracking()
            .Where(r => r.GameId == game.Id)
            .OrderBy(r => r.Kind)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);

        var relatedGameIds = relations
            .Where(r => r.RelatedGameId is not null)
            .Select(r => r.RelatedGameId!.Value)
            .Distinct()
            .ToList();
        var relatedSlugs = relatedGameIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Games.AsNoTracking()
                .Where(g => relatedGameIds.Contains(g.Id))
                .ToDictionaryAsync(g => g.Id, g => g.Slug, cancellationToken);

        _jobs.EnqueueRecordGameView(game.Id);

        return GameDtoMapper.ToDetail(
            game,
            viewerReviewId,
            hasReviewBombEvents,
            _config.Ranking.ScoreLabelMinimumReviews,
            relations.Select(r => new GameDtoMapper.RelatedItem(
                r.Kind.ToString(),
                r.Provider.ToString(),
                r.ExternalId,
                r.Name,
                r.CoverImageUrl,
                r.ReleaseDate?.ToString("yyyy-MM-dd"),
                r.RelatedGameId is null ? null : relatedSlugs.GetValueOrDefault(r.RelatedGameId.Value))).ToList());
    }

    public async Task<IReadOnlyList<object>> ListPlatformsAsync(CancellationToken cancellationToken = default)
    {
        var platforms = await _db.Platforms.AsNoTracking().OrderBy(p => p.SortOrder).ToListAsync(cancellationToken);
        return platforms.Select(p => new
        {
            id = p.Id,
            slug = p.Slug,
            name = p.Name,
            abbreviation = p.Abbreviation,
            family = p.Family.ToString(),
        }).Cast<object>().ToList();
    }

    public async Task<IReadOnlyList<object>> ListGenresAsync(CancellationToken cancellationToken = default)
    {
        var genres = await _db.Genres.AsNoTracking().OrderBy(g => g.Name).ToListAsync(cancellationToken);
        return genres.Select(g => new { id = g.Id, slug = g.Slug, name = g.Name }).Cast<object>().ToList();
    }

    public async Task<object> GetStatisticsBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        var game = await _db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Slug == slug, cancellationToken);
        if (game is null)
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        var stats = await _db.GameStatistics.AsNoTracking()
            .FirstOrDefaultAsync(s => s.GameId == game.Id, cancellationToken);

        var minLabel = _config.Ranking.ScoreLabelMinimumReviews;
        var minPlatform = _config.Ranking.PlatformMinimumReviews;

        var score = stats is null
            ? GameScoreCalculator.Calculate(new RecommendationCounts(0, 0), minLabel)
            : GameScoreCalculator.Calculate(
                new RecommendationCounts(stats.PositiveReviews, stats.NegativeReviews),
                minLabel);

        object? scoreExcludingBombs = null;
        if (stats is not null
            && (stats.TotalReviewsExcludingBombs != stats.TotalReviews
                || stats.PositiveReviewsExcludingBombs != stats.PositiveReviews
                || stats.NegativeReviewsExcludingBombs != stats.NegativeReviews))
        {
            var excluding = GameScoreCalculator.Calculate(
                new RecommendationCounts(stats.PositiveReviewsExcludingBombs, stats.NegativeReviewsExcludingBombs),
                minLabel);
            scoreExcludingBombs = ToScoreDto(excluding, stats.AverageRating, stats.RatingCount);
        }

        var platformRows = await (
            from ps in _db.GameStatisticsPlatforms.AsNoTracking()
            join p in _db.Platforms.AsNoTracking() on ps.PlatformId equals p.Id
            where ps.GameId == game.Id && ps.TotalReviews >= minPlatform
            orderby ps.TotalReviews descending
            select new { ps, p }).ToListAsync(cancellationToken);

        var platforms = platformRows.Select(row =>
        {
            var platformScore = GameScoreCalculator.Calculate(
                new RecommendationCounts(row.ps.PositiveReviews, row.ps.NegativeReviews),
                minLabel);
            return new
            {
                platform = new
                {
                    id = row.p.Id,
                    slug = row.p.Slug,
                    name = row.p.Name,
                    abbreviation = row.p.Abbreviation,
                    family = row.p.Family.ToString(),
                },
                totalReviews = platformScore.TotalReviews,
                positiveReviews = platformScore.PositiveReviews,
                negativeReviews = platformScore.NegativeReviews,
                positivePercentage = platformScore.PositivePercentage,
                confidenceScore = platformScore.ConfidenceScore,
                label = platformScore.Label,
            };
        }).ToList();

        var families = platformRows
            .GroupBy(row => row.p.Family)
            .Select(group =>
            {
                var positive = group.Sum(x => x.ps.PositiveReviews);
                var negative = group.Sum(x => x.ps.NegativeReviews);
                var familyScore = GameScoreCalculator.Calculate(new RecommendationCounts(positive, negative), minLabel);
                return new
                {
                    family = group.Key.ToString(),
                    totalReviews = familyScore.TotalReviews,
                    positiveReviews = familyScore.PositiveReviews,
                    negativeReviews = familyScore.NegativeReviews,
                    positivePercentage = familyScore.PositivePercentage,
                    confidenceScore = familyScore.ConfidenceScore,
                    label = familyScore.Label,
                };
            })
            .OrderByDescending(f => f.totalReviews)
            .ToList();

        var timelineRows = await _db.GameActivityDaily.AsNoTracking()
            .Where(a => a.GameId == game.Id && a.ReviewCount > 0)
            .OrderBy(a => a.Date)
            .ToListAsync(cancellationToken);
        var timeline = timelineRows.Select(a => new
        {
            date = a.Date.ToString("yyyy-MM-dd"),
            positive = a.PositiveCount,
            negative = a.NegativeCount,
            total = a.ReviewCount,
        }).ToList();

        var bombRows = await _db.ReviewBombEvents.AsNoTracking()
            .Where(e => e.GameId == game.Id && e.Status != DbReviewBombStatus.DISMISSED)
            .OrderByDescending(e => e.DetectedAt)
            .ToListAsync(cancellationToken);
        var reviewBombEvents = bombRows.Select(e => new
        {
            id = e.Id,
            startAt = DateTime.SpecifyKind(e.StartAt, DateTimeKind.Utc).ToString("O"),
            endAt = DateTime.SpecifyKind(e.EndAt, DateTimeKind.Utc).ToString("O"),
            positiveCount = e.PositiveCount,
            negativeCount = e.NegativeCount,
            severity = e.Severity,
            status = e.Status.ToString(),
        }).ToList();

        var hours = await _db.Reviews.AsNoTracking()
            .Where(r => r.GameId == game.Id
                && r.DeletedAt == null
                && r.Status == DbReviewStatus.PUBLISHED
                && r.HoursPlayed != null)
            .Select(r => new { Hours = r.HoursPlayed!.Value, r.Recommended })
            .ToListAsync(cancellationToken);

        var hoursPlayedDistribution = BuildHoursBuckets(hours.Select(h => (h.Hours, h.Recommended)));

        return new
        {
            gameId = game.Id,
            slug = game.Slug,
            score = ToScoreDto(score, stats?.AverageRating, stats?.RatingCount ?? 0),
            scoreExcludingReviewBombs = scoreExcludingBombs,
            platforms,
            families,
            timeline,
            reviewBombEvents,
            hoursPlayedDistribution,
            lastCalculatedAt = stats is null
                ? DateTime.UtcNow.ToString("O")
                : DateTime.SpecifyKind(stats.LastCalculatedAt, DateTimeKind.Utc).ToString("O"),
        };
    }

    private static object ToScoreDto(GameScoreResult score, double? averageRating, int ratingCount) =>
        new
        {
            totalReviews = score.TotalReviews,
            positiveReviews = score.PositiveReviews,
            negativeReviews = score.NegativeReviews,
            positivePercentage = score.PositivePercentage,
            confidenceScore = score.ConfidenceScore,
            label = score.Label,
            averageRating,
            ratingCount,
        };

    private static IReadOnlyList<object> BuildHoursBuckets(IEnumerable<(int Hours, bool Recommended)> rows)
    {
        var buckets = new (string Key, Func<int, bool> Match)[]
        {
            ("0-2", h => h < 2),
            ("2-10", h => h >= 2 && h < 10),
            ("10-50", h => h >= 10 && h < 50),
            ("50+", h => h >= 50),
        };

        return buckets.Select(bucket =>
        {
            var matched = rows.Where(r => bucket.Match(r.Hours)).ToList();
            return (object)new
            {
                bucket = bucket.Key,
                count = matched.Count,
                positive = matched.Count(m => m.Recommended),
                negative = matched.Count(m => !m.Recommended),
            };
        }).ToList();
    }
}
public static class GameDtoMapper
{
    public static object ToSummary(GameEntity game, int labelMinimumReviews)
    {
        var stats = game.Statistics;
        var score = stats is null
            ? GameScoreCalculator.Calculate(new RecommendationCounts(0, 0), labelMinimumReviews)
            : GameScoreCalculator.Calculate(
                new RecommendationCounts(stats.PositiveReviews, stats.NegativeReviews),
                labelMinimumReviews);

        return new
        {
            id = game.Id,
            slug = game.Slug,
            name = game.Name,
            coverImageUrl = game.CoverImageUrl,
            releaseDate = game.ReleaseDate?.ToString("yyyy-MM-dd"),
            developer = game.Developer,
            publisher = game.Publisher,
            platforms = game.Platforms.Select(p => new
            {
                id = p.Platform.Id,
                slug = p.Platform.Slug,
                name = p.Platform.Name,
                abbreviation = p.Platform.Abbreviation,
                family = p.Platform.Family.ToString(),
            }),
            genres = game.Genres.Select(g => new
            {
                id = g.Genre.Id,
                slug = g.Genre.Slug,
                name = g.Genre.Name,
            }),
            score = new
            {
                totalReviews = score.TotalReviews,
                positiveReviews = score.PositiveReviews,
                negativeReviews = score.NegativeReviews,
                positivePercentage = score.PositivePercentage,
                confidenceScore = score.ConfidenceScore,
                label = score.Label,
                averageRating = stats?.AverageRating,
                ratingCount = stats?.RatingCount ?? 0,
            },
        };
    }

    public sealed record RelatedItem(
        string Kind,
        string Provider,
        string ExternalId,
        string Name,
        string? CoverImageUrl,
        string? ReleaseDate,
        string? LocalSlug);

    public static object ToDetail(
        GameEntity game,
        Guid? viewerReviewId,
        bool hasReviewBombEvents,
        int labelMinimumReviews,
        IReadOnlyList<RelatedItem>? related = null)
    {
        var stats = game.Statistics;
        var score = stats is null
            ? GameScoreCalculator.Calculate(new RecommendationCounts(0, 0), labelMinimumReviews)
            : GameScoreCalculator.Calculate(
                new RecommendationCounts(stats.PositiveReviews, stats.NegativeReviews),
                labelMinimumReviews);

        return new
        {
            id = game.Id,
            slug = game.Slug,
            name = game.Name,
            summary = game.Summary,
            description = game.Description,
            developer = game.Developer,
            publisher = game.Publisher,
            releaseDate = game.ReleaseDate?.ToString("yyyy-MM-dd"),
            coverImageUrl = game.CoverImageUrl,
            bannerImageUrl = game.BannerImageUrl,
            trailerYoutubeId = game.TrailerYoutubeId,
            galleryImageUrls = game.GalleryImageUrls ?? Array.Empty<string>(),
            viewCount = game.ViewCount,
            createdAt = DateTime.SpecifyKind(game.CreatedAt, DateTimeKind.Utc).ToString("O"),
            updatedAt = DateTime.SpecifyKind(game.UpdatedAt, DateTimeKind.Utc).ToString("O"),
            platforms = game.Platforms.Select(p => new
            {
                id = p.Platform.Id,
                slug = p.Platform.Slug,
                name = p.Platform.Name,
                abbreviation = p.Platform.Abbreviation,
                family = p.Platform.Family.ToString(),
            }),
            genres = game.Genres.Select(g => new
            {
                id = g.Genre.Id,
                slug = g.Genre.Slug,
                name = g.Genre.Name,
            }),
            score = new
            {
                totalReviews = score.TotalReviews,
                positiveReviews = score.PositiveReviews,
                negativeReviews = score.NegativeReviews,
                positivePercentage = score.PositivePercentage,
                confidenceScore = score.ConfidenceScore,
                label = score.Label,
                averageRating = stats?.AverageRating,
                ratingCount = stats?.RatingCount ?? 0,
            },
            viewerReviewId,
            hasReviewBombEvents,
            related = (related ?? Array.Empty<RelatedItem>()).Select(r => new
            {
                kind = r.Kind,
                provider = r.Provider,
                externalId = r.ExternalId,
                name = r.Name,
                coverImageUrl = r.CoverImageUrl,
                releaseDate = r.ReleaseDate,
                localSlug = r.LocalSlug,
            }),
        };
    }
}
