using GameScore.Application.Errors;
using GameScore.Application.Http;
using GameScore.Domain.Enums;
using GameScore.Infrastructure.Auth;
using GameScore.Infrastructure.Integrations;
using GameScore.Infrastructure.Mappers;
using GameScore.Infrastructure.Persistence;
using GameScore.Infrastructure.Reviews;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace GameScore.Infrastructure.Users;

public sealed class UsersService
{
    private readonly GameScoreDbContext _db;
    private readonly ReviewDataAccess _reviews;
    private readonly PasswordHasher _passwords;

    public UsersService(GameScoreDbContext db, ReviewDataAccess reviews, PasswordHasher passwords)
    {
        _db = db;
        _reviews = reviews;
        _passwords = passwords;
    }

    public async Task<object> GetProfileAsync(string username, CancellationToken cancellationToken = default)
    {
        var user = await FindPublicUserAsync(username, cancellationToken);
        var published = _db.Reviews.AsNoTracking()
            .Where(r => r.UserId == user.Id && r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED);

        var agg = await published
            .GroupBy(r => r.Recommended)
            .Select(g => new { Recommended = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var recommended = agg.Where(a => a.Recommended).Sum(a => a.Count);
        var notRecommended = agg.Where(a => !a.Recommended).Sum(a => a.Count);
        var totalReviews = recommended + notRecommended;

        var usefulVotes = await published.SumAsync(r => r.UsefulCount, cancellationToken);
        var hours = await published.Where(r => r.HoursPlayed != null).SumAsync(r => r.HoursPlayed ?? 0, cancellationToken);
        var gamesReviewed = await published.Select(r => r.GameId).Distinct().CountAsync(cancellationToken);

        return new
        {
            id = user.Id,
            username = user.Username,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            reputationScore = user.ReputationScore,
            role = user.Role.ToString(),
            deleted = false,
            bio = user.Bio,
            createdAt = user.CreatedAt.ToString("O"),
            stats = new
            {
                totalReviews,
                recommendedCount = recommended,
                notRecommendedCount = notRecommended,
                recommendationPercentage = totalReviews == 0 ? 0 : Math.Round(recommended / (double)totalReviews * 10000) / 100,
                usefulVotesReceived = usefulVotes,
                gamesReviewed,
                totalHoursPlayed = hours,
            },
        };
    }

    public async Task<object> ListReviewsAsync(
        string username,
        string? cursor,
        int? limit,
        Guid? viewerId,
        CancellationToken cancellationToken = default)
    {
        var user = await FindPublicUserAsync(username, cancellationToken);
        var pageSize = Pagination.ClampLimit(limit, Pagination.DefaultCursorSize);
        var (items, nextCursor) = await _reviews.ListByUserAsync(user.Id, cursor, pageSize, cancellationToken);
        var mapped = await MapReviewsAsync(items, viewerId, cancellationToken);
        return new { items = mapped, meta = Pagination.CursorMeta(pageSize, nextCursor) };
    }

    public async Task<object> ExportMeAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null, cancellationToken);
        if (user is null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "Account not found");
        }

        var reviews = await _db.Reviews.AsNoTracking()
            .Include(r => r.Game)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        var votes = await _db.ReviewVotes.AsNoTracking()
            .Where(v => v.UserId == userId)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(cancellationToken);

        var reports = await _db.ReviewReports.AsNoTracking()
            .Where(r => r.ReporterId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        var reputationEvents = await _db.ReputationEvents.AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        return new
        {
            exportedAt = DateTime.UtcNow.ToString("O"),
            account = new
            {
                email = user.Email,
                username = user.Username,
                displayName = user.DisplayName,
                bio = user.Bio,
                avatarUrl = user.AvatarUrl,
                reputationScore = user.ReputationScore,
                role = user.Role.ToString(),
                status = user.Status.ToString(),
                emailVerified = user.EmailVerifiedAt is not null,
                termsAcceptedAt = user.TermsAcceptedAt?.ToString("O"),
                createdAt = user.CreatedAt.ToString("O"),
            },
            reviews = reviews.Select(r => new
            {
                id = r.Id,
                gameId = r.GameId,
                gameSlug = r.Game.Slug,
                gameName = r.Game.Name,
                recommended = r.Recommended,
                rating = r.Rating,
                text = r.Text,
                hoursPlayed = r.HoursPlayed,
                createdAt = r.CreatedAt.ToString("O"),
                updatedAt = r.UpdatedAt.ToString("O"),
                status = r.Status.ToString(),
            }),
            votes = votes.Select(v => new
            {
                reviewId = v.ReviewId,
                useful = v.Useful,
                createdAt = v.CreatedAt.ToString("O"),
            }),
            reports = reports.Select(r => new
            {
                id = r.Id,
                reviewId = r.ReviewId,
                reason = r.Reason.ToString(),
                details = r.Details,
                status = r.Status.ToString(),
                createdAt = r.CreatedAt.ToString("O"),
            }),
            reputationEvents = reputationEvents.Select(e => new
            {
                id = e.Id,
                reason = e.Reason.ToString(),
                delta = e.Delta,
                balanceAfter = e.BalanceAfter,
                createdAt = e.CreatedAt.ToString("O"),
            }),
        };
    }

    public async Task<object> UpdateMeAsync(
        Guid userId,
        string? displayName,
        string? bio,
        string? avatarUrl,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "Account not found");
        }

        if (displayName is not null)
        {
            user.DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        }

        if (bio is not null)
        {
            user.Bio = string.IsNullOrWhiteSpace(bio) ? null : bio.Trim();
        }

        if (avatarUrl is not null)
        {
            if (!string.IsNullOrWhiteSpace(avatarUrl) && !CdnImageRules.IsAllowedImageUrl(avatarUrl))
            {
                throw new BadRequestException(ErrorCodes.InvalidAvatarUrl, "Avatar URL must be HTTPS from an allowed host");
            }

            user.AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim();
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.UserMapper.ToAuthenticatedUser(user);
    }

    public async Task DeleteMeAsync(Guid userId, string password, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return;
        }

        if (!await _passwords.VerifyAsync(user.PasswordHash, password, cancellationToken))
        {
            throw new UnauthorizedException(ErrorCodes.InvalidCredentials, "Password is incorrect");
        }

        user.DeletedAt = DateTime.UtcNow;
        user.Email = $"deleted-{user.Id:N}@anonymous.local";
        user.Username = $"deleted-{user.Id:N}"[..Math.Min(32, $"deleted-{user.Id:N}".Length)];
        user.DisplayName = null;
        user.Bio = null;
        user.AvatarUrl = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<UserEntity> FindPublicUserAsync(string username, CancellationToken cancellationToken)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username == username.Trim().ToLowerInvariant(), cancellationToken);
        if (user is null || user.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "User not found");
        }

        return user;
    }

    private async Task<IReadOnlyList<object>> MapReviewsAsync(
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
}
