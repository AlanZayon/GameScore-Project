using GameScore.Application.Http;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GameScore.Infrastructure.Reviews;

public sealed record ReviewBundle(
    ReviewEntity Review,
    UserEntity Author,
    GameEntity Game,
    PlatformEntity? Platform);

public sealed class ReviewDataAccess(GameScoreDbContext db)
{
    public async Task<ReviewBundle?> LoadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var review = await db.Reviews.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (review is null)
        {
            return null;
        }

        return await BundleAsync(review, cancellationToken);
    }

    public async Task<ReviewBundle?> LoadTrackedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (review is null)
        {
            return null;
        }

        var author = await db.Users.FirstAsync(u => u.Id == review.UserId, cancellationToken);
        var game = await db.Games.FirstAsync(g => g.Id == review.GameId, cancellationToken);
        PlatformEntity? platform = review.PlatformId is null
            ? null
            : await db.Platforms.FirstOrDefaultAsync(p => p.Id == review.PlatformId, cancellationToken);
        return new ReviewBundle(review, author, game, platform);
    }

    public async Task<(IReadOnlyList<ReviewBundle> Items, string? NextCursor)> ListForGameAsync(
        Guid gameId,
        string sort,
        string recommendation,
        Guid? platformId,
        int? minHours,
        int? maxHours,
        string? cursor,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var query = db.Reviews.AsNoTracking()
            .Where(r => r.GameId == gameId && r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED);

        if (recommendation == "POSITIVE")
        {
            query = query.Where(r => r.Recommended);
        }
        else if (recommendation == "NEGATIVE")
        {
            query = query.Where(r => !r.Recommended);
        }

        if (platformId is not null)
        {
            query = query.Where(r => r.PlatformId == platformId);
        }

        if (minHours is not null)
        {
            query = query.Where(r => r.HoursPlayed >= minHours);
        }

        if (maxHours is not null)
        {
            query = query.Where(r => r.HoursPlayed <= maxHours);
        }

        var take = limit + 1;
        List<ReviewEntity> items;

        if (sort == "RECENT")
        {
            var decoded = cursor is null ? null : Pagination.DecodeCursor<RecentCursor>(cursor);
            if (decoded is not null)
            {
                var createdAt = DateTime.Parse(decoded.CreatedAt);
                query = query.Where(r =>
                    r.CreatedAt < createdAt
                    || (r.CreatedAt == createdAt && r.Id < decoded.Id));
            }

            items = await query
                .OrderByDescending(r => r.CreatedAt)
                .ThenByDescending(r => r.Id)
                .Take(take)
                .ToListAsync(cancellationToken);
        }
        else if (sort == "MOST_USEFUL")
        {
            var decoded = cursor is null ? null : Pagination.DecodeCursor<RankingCursor>(cursor);
            if (decoded is not null)
            {
                query = query.Where(r =>
                    r.UsefulCount < decoded.RankingScore
                    || (r.UsefulCount == decoded.RankingScore && r.Id < decoded.Id));
            }

            items = await query
                .OrderByDescending(r => r.UsefulCount)
                .ThenByDescending(r => r.Id)
                .Take(take)
                .ToListAsync(cancellationToken);
        }
        else
        {
            var decoded = cursor is null ? null : Pagination.DecodeCursor<RankingCursor>(cursor);
            if (decoded is not null)
            {
                query = query.Where(r =>
                    r.RankingScore < decoded.RankingScore
                    || (r.RankingScore == decoded.RankingScore && r.Id < decoded.Id));
            }

            items = await query
                .OrderByDescending(r => r.RankingScore)
                .ThenByDescending(r => r.Id)
                .Take(take)
                .ToListAsync(cancellationToken);
        }

        var hasMore = items.Count > limit;
        var page = hasMore ? items.Take(limit).ToList() : items;
        var bundles = await BundleManyAsync(page, cancellationToken);
        var last = page.LastOrDefault();
        string? nextCursor = null;
        if (hasMore && last is not null)
        {
            nextCursor = sort switch
            {
                "RECENT" => Pagination.EncodeCursor(new RecentCursor(last.CreatedAt.ToString("O"), last.Id)),
                "MOST_USEFUL" => Pagination.EncodeCursor(new RankingCursor(last.UsefulCount, last.Id)),
                _ => Pagination.EncodeCursor(new RankingCursor(last.RankingScore, last.Id)),
            };
        }

        return (bundles, nextCursor);
    }

    public async Task<(IReadOnlyList<ReviewBundle> Items, string? NextCursor)> ListByUserAsync(
        Guid userId,
        string? cursor,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var query = db.Reviews.AsNoTracking()
            .Where(r => r.UserId == userId && r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED);

        var decoded = cursor is null ? null : Pagination.DecodeCursor<RecentCursor>(cursor);
        if (decoded is not null)
        {
            var createdAt = DateTime.Parse(decoded.CreatedAt);
            query = query.Where(r =>
                r.CreatedAt < createdAt
                || (r.CreatedAt == createdAt && r.Id < decoded.Id));
        }

        var take = limit + 1;
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

        var hasMore = items.Count > limit;
        var page = hasMore ? items.Take(limit).ToList() : items;
        var bundles = await BundleManyAsync(page, cancellationToken);
        var last = page.LastOrDefault();
        var nextCursor = hasMore && last is not null
            ? Pagination.EncodeCursor(new RecentCursor(last.CreatedAt.ToString("O"), last.Id))
            : null;
        return (bundles, nextCursor);
    }

    public async Task<(Dictionary<Guid, bool> Votes, HashSet<Guid> Reports)> ViewerContextAsync(
        IReadOnlyList<Guid> reviewIds,
        Guid viewerId,
        CancellationToken cancellationToken = default)
    {
        if (reviewIds.Count == 0)
        {
            return ([], []);
        }

        var votes = await db.ReviewVotes.AsNoTracking()
            .Where(v => v.UserId == viewerId && reviewIds.Contains(v.ReviewId))
            .ToDictionaryAsync(v => v.ReviewId, v => v.Useful, cancellationToken);

        var reports = await db.ReviewReports.AsNoTracking()
            .Where(r => r.ReporterId == viewerId && reviewIds.Contains(r.ReviewId))
            .Select(r => r.ReviewId)
            .ToListAsync(cancellationToken);

        return (votes, reports.ToHashSet());
    }

    private async Task<ReviewBundle> BundleAsync(ReviewEntity review, CancellationToken cancellationToken)
    {
        var author = await db.Users.AsNoTracking().FirstAsync(u => u.Id == review.UserId, cancellationToken);
        var game = await db.Games.AsNoTracking().FirstAsync(g => g.Id == review.GameId, cancellationToken);
        PlatformEntity? platform = review.PlatformId is null
            ? null
            : await db.Platforms.AsNoTracking().FirstOrDefaultAsync(p => p.Id == review.PlatformId, cancellationToken);
        return new ReviewBundle(review, author, game, platform);
    }

    private async Task<List<ReviewBundle>> BundleManyAsync(List<ReviewEntity> reviews, CancellationToken cancellationToken)
    {
        if (reviews.Count == 0)
        {
            return [];
        }

        var userIds = reviews.Select(r => r.UserId).Distinct().ToList();
        var gameIds = reviews.Select(r => r.GameId).Distinct().ToList();
        var platformIds = reviews.Where(r => r.PlatformId != null).Select(r => r.PlatformId!.Value).Distinct().ToList();

        var users = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, cancellationToken);
        var games = await db.Games.AsNoTracking().Where(g => gameIds.Contains(g.Id)).ToDictionaryAsync(g => g.Id, cancellationToken);
        var platforms = platformIds.Count == 0
            ? new Dictionary<Guid, PlatformEntity>()
            : await db.Platforms.AsNoTracking().Where(p => platformIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, cancellationToken);

        return reviews.Select(r => new ReviewBundle(
            r,
            users[r.UserId],
            games[r.GameId],
            r.PlatformId is null ? null : platforms.GetValueOrDefault(r.PlatformId.Value))).ToList();
    }

    private sealed record RecentCursor(string CreatedAt, Guid Id);

    private sealed record RankingCursor(double RankingScore, Guid Id);
}
