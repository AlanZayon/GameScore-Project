using GameScore.Application.Errors;
using GameScore.Application.Http;
using GameScore.Domain.Enums;
using GameScore.Domain.Scoring;
using GameScore.Infrastructure.Cache;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GameScore.Infrastructure.Users;

public sealed class UserStatisticsService
{
    private const int MinReviewsForAnalytics = 3;
    private const int MinReviewsForCategory = 3;
    private const string UnspecifiedPlatformKey = "unspecified";

    private static readonly (string Bucket, int Min, int? Max)[] HoursBuckets =
    [
        ("0-2", 0, 2),
        ("2-10", 2, 10),
        ("10-50", 10, 50),
        ("50+", 50, null),
    ];

    private readonly GameScoreDbContext _db;
    private readonly CacheService _cache;

    public UserStatisticsService(GameScoreDbContext db, CacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<object> GetStatisticsAsync(
        string username,
        string range,
        string? viewerRole,
        CancellationToken cancellationToken = default)
    {
        var user = await FindUserAsync(username, cancellationToken);
        var includeSensitive = IsStaff(viewerRole);
        var cacheKey = $"user-stats:{user.Id}:{range}:{(includeSensitive ? "staff" : "public")}";

        var cached = await _cache.GetAsync<object>(cacheKey, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var computed = await ComputeStatisticsAsync(user, range, includeSensitive, cancellationToken);
        await _cache.SetAsync(cacheKey, computed, TimeSpan.FromMinutes(5), cancellationToken);
        return computed;
    }

    public async Task<object> ListReputationEventsAsync(
        string username,
        string? cursor,
        int? limit,
        string? viewerRole,
        CancellationToken cancellationToken = default)
    {
        var user = await FindUserAsync(username, cancellationToken);
        var pageSize = Pagination.ClampLimit(limit, Pagination.DefaultCursorSize);
        var includeSensitive = IsStaff(viewerRole);

        (DateTime CreatedAt, Guid Id)? cursorPayload = null;
        if (cursor is not null)
        {
            var decoded = Pagination.DecodeCursor<ReputationCursor>(cursor);
            cursorPayload = (DateTime.Parse(decoded.CreatedAt), decoded.Id);
        }

        var query = _db.ReputationEvents.AsNoTracking().Where(e => e.UserId == user.Id);
        if (!includeSensitive)
        {
            query = query.Where(e =>
                e.Reason != DbReputationReason.REVIEW_REMOVED_BY_MODERATOR
                && e.Reason != DbReputationReason.ABUSE_CONFIRMED);
        }

        if (cursorPayload is not null)
        {
            var (createdAt, id) = cursorPayload.Value;
            query = query.Where(e =>
                e.CreatedAt < createdAt || (e.CreatedAt == createdAt && e.Id < id));
        }

        var events = await query
            .OrderByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.Id)
            .Take(pageSize + 1)
            .ToListAsync(cancellationToken);

        var page = events.Take(pageSize).ToList();
        string? nextCursor = null;
        if (events.Count > pageSize)
        {
            var last = page[^1];
            nextCursor = Pagination.EncodeCursor(new ReputationCursor(last.CreatedAt.ToString("O"), last.Id));
        }

        return new
        {
            items = page.Select(e => new
            {
                id = e.Id,
                reason = e.Reason.ToString(),
                delta = e.Delta,
                balanceAfter = e.BalanceAfter,
                createdAt = e.CreatedAt.ToString("O"),
            }),
            meta = Pagination.CursorMeta(pageSize, nextCursor),
        };
    }

    private async Task<object> ComputeStatisticsAsync(
        UserEntity user,
        string range,
        bool includeSensitive,
        CancellationToken cancellationToken)
    {
        var start = RangeStart(range);

        var allReviews = await _db.Reviews.AsNoTracking()
            .Where(r => r.UserId == user.Id && r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED)
            .Include(r => r.Platform)
            .Include(r => r.Game)
            .ThenInclude(g => g.Genres)
            .ThenInclude(gg => gg.Genre)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        var allEvents = await _db.ReputationEvents.AsNoTracking()
            .Where(e => e.UserId == user.Id)
            .OrderBy(e => e.CreatedAt)
            .Select(e => new ReputationEventAgg(e.Reason, e.Delta, e.BalanceAfter, e.CreatedAt))
            .ToListAsync(cancellationToken);

        var siteAgg = await _db.Reviews.AsNoTracking()
            .Where(r => r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED)
            .GroupBy(r => r.Recommended)
            .Select(g => new { Recommended = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var rangedReviews = allReviews.Where(r => InRange(r.CreatedAt, start)).ToList();
        var rangedEvents = allEvents.Where(e => InRange(e.CreatedAt, start)).ToList();

        var sitePositive = siteAgg.Where(x => x.Recommended).Sum(x => x.Count);
        var siteTotal = siteAgg.Sum(x => x.Count);

        var recommended = rangedReviews.Count(r => r.Recommended);
        var notRecommended = rangedReviews.Count - recommended;
        var sampleSize = rangedReviews.Count;

        var usefulSum = rangedReviews.Sum(r => r.UsefulCount);
        var notUsefulSum = rangedReviews.Sum(r => r.NotUsefulCount);
        var voteTotal = usefulSum + notUsefulSum;
        double? usefulRate = voteTotal == 0
            ? null
            : Math.Round(usefulSum / (double)voteTotal * 10000) / 100;

        var hoursReviews = rangedReviews.Where(r => r.HoursPlayed is not null).ToList();
        var totalHoursPlayed = hoursReviews.Sum(r => r.HoursPlayed!.Value);
        double? averageHoursPlayed = hoursReviews.Count == 0
            ? null
            : Math.Round(totalHoursPlayed / (double)hoursReviews.Count * 100) / 100;

        var allTimeCount = allReviews.Count;
        var analyticsAvailable = allTimeCount >= MinReviewsForAnalytics;
        var gamesReviewed = allReviews.Select(r => r.GameId).Distinct().Count();

        return new
        {
            username = user.Username,
            range,
            sampleSize,
            analyticsAvailable,
            recommendedCount = recommended,
            notRecommendedCount = notRecommended,
            recommendationPercentage = RecommendationPercentage(recommended, sampleSize),
            siteRecommendationPercentage = RecommendationPercentage(sitePositive, siteTotal),
            usefulRate,
            totalHoursPlayed,
            averageHoursPlayed,
            gamesReviewed,
            byGenre = analyticsAvailable ? AggregateCategoryBuckets(rangedReviews, CategoryMode.Genre) : Array.Empty<object>(),
            byPlatform = analyticsAvailable ? AggregateCategoryBuckets(rangedReviews, CategoryMode.Platform) : Array.Empty<object>(),
            timeline = analyticsAvailable ? BuildTimeline(rangedReviews, rangedEvents, range) : Array.Empty<object>(),
            hoursPlayedDistribution = analyticsAvailable ? AggregateHoursBuckets(rangedReviews) : Array.Empty<object>(),
            reputation = BuildReputationSummary(user.ReputationScore, allEvents, includeSensitive),
            topUsefulReviews = analyticsAvailable ? BuildTopUsefulReviews(rangedReviews) : Array.Empty<object>(),
            activity = analyticsAvailable
                ? BuildActivity(rangedReviews)
                : new { activeMonths = 0, reviewsPerMonth = 0.0 },
        };
    }

    private static object[] AggregateCategoryBuckets(IReadOnlyList<ReviewEntity> reviews, CategoryMode mode)
    {
        var map = new Dictionary<string, (string Name, int ReviewCount, int RecommendedCount)>(StringComparer.Ordinal);

        foreach (var review in reviews)
        {
            if (mode == CategoryMode.Genre)
            {
                if (review.Game.Genres.Count == 0) continue;
                foreach (var row in review.Game.Genres)
                {
                    var key = row.Genre.Slug;
                    if (!map.TryGetValue(key, out var current))
                    {
                        current = (row.Genre.Name, 0, 0);
                    }

                    current.ReviewCount += 1;
                    if (review.Recommended) current.RecommendedCount += 1;
                    map[key] = current;
                }

                continue;
            }

            var platformKey = review.Platform?.Slug ?? UnspecifiedPlatformKey;
            var platformName = review.Platform?.Name ?? "Unspecified";
            if (!map.TryGetValue(platformKey, out var platformCurrent))
            {
                platformCurrent = (platformName, 0, 0);
            }

            platformCurrent.ReviewCount += 1;
            if (review.Recommended) platformCurrent.RecommendedCount += 1;
            map[platformKey] = platformCurrent;
        }

        return map
            .Where(kv => kv.Value.ReviewCount >= MinReviewsForCategory)
            .Select(kv => new
            {
                key = kv.Key,
                name = kv.Value.Name,
                reviewCount = kv.Value.ReviewCount,
                recommendedCount = kv.Value.RecommendedCount,
                recommendationPercentage = RecommendationPercentage(kv.Value.RecommendedCount, kv.Value.ReviewCount),
            })
            .OrderByDescending(x => x.reviewCount)
            .ThenBy(x => x.name, StringComparer.Ordinal)
            .Cast<object>()
            .ToArray();
    }

    private static object[] AggregateHoursBuckets(IReadOnlyList<ReviewEntity> reviews)
    {
        var withHours = reviews.Where(r => r.HoursPlayed is not null).ToList();
        return HoursBuckets.Select(bucket =>
        {
            var matched = withHours.Where(r =>
            {
                var hours = r.HoursPlayed!.Value;
                if (bucket.Max is null) return hours >= bucket.Min;
                return hours >= bucket.Min && hours < bucket.Max.Value;
            }).ToList();
            var recommendedCount = matched.Count(r => r.Recommended);
            return (object)new
            {
                bucket = bucket.Bucket,
                count = matched.Count,
                recommendedCount,
                notRecommendedCount = matched.Count - recommendedCount,
            };
        }).ToArray();
    }

    private static object[] BuildTimeline(
        IReadOnlyList<ReviewEntity> reviews,
        IReadOnlyList<ReputationEventAgg> events,
        string range)
    {
        var useMonths = range is "all" or "12m";
        var reviewBuckets = new Dictionary<string, (int Reviews, int RecommendedCount)>(StringComparer.Ordinal);

        foreach (var review in reviews)
        {
            var key = BucketKey(review.CreatedAt, useMonths);
            if (!reviewBuckets.TryGetValue(key, out var current))
            {
                current = (0, 0);
            }

            current.Reviews += 1;
            if (review.Recommended) current.RecommendedCount += 1;
            reviewBuckets[key] = current;
        }

        var reputationByBucket = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var evt in events.OrderBy(e => e.CreatedAt))
        {
            reputationByBucket[BucketKey(evt.CreatedAt, useMonths)] = evt.BalanceAfter;
        }

        var keys = reviewBuckets.Keys.Concat(reputationByBucket.Keys).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal);
        return keys.Select(date =>
        {
            reviewBuckets.TryGetValue(date, out var reviewsBucket);
            reputationByBucket.TryGetValue(date, out var reputationScore);
            var hasReputation = reputationByBucket.ContainsKey(date);
            return (object)new
            {
                date,
                reviews = reviewsBucket.Reviews,
                recommendedCount = reviewsBucket.RecommendedCount,
                recommendationPercentage = RecommendationPercentage(reviewsBucket.RecommendedCount, reviewsBucket.Reviews),
                reputationScore = hasReputation ? (int?)reputationScore : null,
            };
        }).ToArray();
    }

    private static object BuildActivity(IReadOnlyList<ReviewEntity> reviews)
    {
        if (reviews.Count == 0)
        {
            return new { activeMonths = 0, reviewsPerMonth = 0.0 };
        }

        var months = reviews
            .Select(r => ToUtc(r.CreatedAt).ToString("yyyy-MM"))
            .Distinct(StringComparer.Ordinal)
            .Count();
        return new
        {
            activeMonths = months,
            reviewsPerMonth = Math.Round(reviews.Count / (double)months * 100) / 100,
        };
    }

    private static object[] BuildTopUsefulReviews(IReadOnlyList<ReviewEntity> reviews, int limit = 5)
    {
        return reviews
            .Where(r => r.UsefulCount > 0)
            .OrderByDescending(r => r.UsefulCount)
            .ThenByDescending(r => r.CreatedAt)
            .Take(limit)
            .Select(r => (object)new
            {
                id = r.Id,
                gameId = r.GameId,
                gameSlug = r.Game.Slug,
                gameName = r.Game.Name,
                gameCoverImageUrl = r.Game.CoverImageUrl,
                recommended = r.Recommended,
                usefulCount = r.UsefulCount,
                notUsefulCount = r.NotUsefulCount,
                textPreview = r.Text.Length <= 160 ? r.Text : r.Text[..160],
                createdAt = r.CreatedAt.ToString("O"),
            })
            .ToArray();
    }

    private static object BuildReputationSummary(
        int score,
        IReadOnlyList<ReputationEventAgg> events,
        bool includeSensitive)
    {
        var usefulVotesReceived = 0;
        var notUsefulVotesReceived = 0;
        var reviewsPublished = 0;
        var reviewsDeleted = 0;
        var moderationNet = 0;
        var moderationPenalties = 0;

        foreach (var evt in events)
        {
            var reason = evt.Reason.ToString();
            if (Reputation.IsSensitiveReason(reason))
            {
                moderationNet += evt.Delta;
                moderationPenalties += Math.Abs(evt.Delta);
                continue;
            }

            switch (evt.Reason)
            {
                case DbReputationReason.USEFUL_VOTE_RECEIVED:
                    usefulVotesReceived += 1;
                    break;
                case DbReputationReason.NOT_USEFUL_VOTE_RECEIVED:
                    notUsefulVotesReceived += 1;
                    break;
                case DbReputationReason.REVIEW_PUBLISHED:
                    reviewsPublished += 1;
                    break;
                case DbReputationReason.REVIEW_DELETED:
                    reviewsDeleted += 1;
                    break;
            }
        }

        object breakdown = includeSensitive
            ? new
            {
                usefulVotesReceived,
                notUsefulVotesReceived,
                reviewsPublished,
                reviewsDeleted,
                moderationPenalties,
            }
            : new
            {
                usefulVotesReceived,
                notUsefulVotesReceived,
                reviewsPublished,
                reviewsDeleted,
            };

        return new
        {
            score,
            tier = Reputation.Tier(score),
            rankingWeightRatio = Math.Round(Reputation.RankingWeightRatio(score) * 1000) / 1000,
            breakdown,
            moderationNet = includeSensitive || moderationNet == 0 ? null : (int?)moderationNet,
        };
    }

    private static string BucketKey(DateTime date, bool useMonths)
    {
        var utc = ToUtc(date);
        return useMonths ? $"{utc:yyyy-MM}-01" : utc.ToString("yyyy-MM-dd");
    }

    private static DateTime ToUtc(DateTime date) =>
        date.Kind switch
        {
            DateTimeKind.Utc => date,
            DateTimeKind.Local => date.ToUniversalTime(),
            _ => DateTime.SpecifyKind(date, DateTimeKind.Utc),
        };

    private static double RecommendationPercentage(int recommended, int total) =>
        total == 0 ? 0 : Math.Round(recommended / (double)total * 10000) / 100;

    private static DateTime? RangeStart(string range) => range switch
    {
        "3m" => DateTime.UtcNow.AddMonths(-3),
        "12m" => DateTime.UtcNow.AddMonths(-12),
        _ => null,
    };

    private static bool InRange(DateTime date, DateTime? start) =>
        start is null || date >= start;

    private static bool IsStaff(string? role) =>
        role is UserRoles.Moderator or UserRoles.Admin;

    private async Task<UserEntity> FindUserAsync(string username, CancellationToken cancellationToken)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username == username.Trim().ToLowerInvariant(), cancellationToken);
        if (user is null || user.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "User not found");
        }

        return user;
    }

    private enum CategoryMode
    {
        Genre,
        Platform,
    }

    private sealed record ReputationEventAgg(
        DbReputationReason Reason,
        int Delta,
        int BalanceAfter,
        DateTime CreatedAt);

    private sealed record ReputationCursor(string CreatedAt, Guid Id);
}
