using GameScore.Application.Configuration;
using GameScore.Domain.Scoring;
using GameScore.Infrastructure.Crypto;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Ratings;

public sealed class ScoreRecalculationService(GameScoreDbContext db, IOptions<AppConfig> config)
{
    public async Task RecalculateAsync(Guid gameId, bool includePlatforms = true, CancellationToken cancellationToken = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await RecalculateInsideAsync(gameId, includePlatforms, cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    public async Task RecalculateInsideAsync(
        Guid gameId,
        bool includePlatforms,
        CancellationToken cancellationToken)
    {
        var visible = db.Reviews.Where(r =>
            r.GameId == gameId
            && r.DeletedAt == null
            && r.Status == DbReviewStatus.PUBLISHED);

        var positive = await visible.CountAsync(r => r.Recommended, cancellationToken);
        var negative = await visible.CountAsync(r => !r.Recommended, cancellationToken);

        var ratingQuery = visible.Where(r => r.Rating != null);
        var ratingCount = await ratingQuery.CountAsync(cancellationToken);
        double? averageRating = ratingCount == 0
            ? null
            : await ratingQuery.AverageAsync(r => (double)r.Rating!.Value, cancellationToken);
        var hoursSum = await visible.Where(r => r.HoursPlayed != null).SumAsync(r => r.HoursPlayed!.Value, cancellationToken);

        var score = GameScoreCalculator.Calculate(
            new RecommendationCounts(positive, negative),
            config.Value.Ranking.ScoreLabelMinimumReviews);

        var bombWindows = await db.ReviewBombEvents
            .Where(e => e.GameId == gameId && e.Status == DbReviewBombStatus.CONFIRMED)
            .Select(e => new { e.StartAt, e.EndAt })
            .ToListAsync(cancellationToken);

        var excludingScore = score;
        if (bombWindows.Count > 0)
        {
            var excludedQuery = visible.Where(r =>
                bombWindows.Any(w => r.CreatedAt >= w.StartAt && r.CreatedAt <= w.EndAt));
            var exPositive = await excludedQuery.CountAsync(r => r.Recommended, cancellationToken);
            var exNegative = await excludedQuery.CountAsync(r => !r.Recommended, cancellationToken);
            excludingScore = GameScoreCalculator.Calculate(
                new RecommendationCounts(
                    Math.Max(0, positive - exPositive),
                    Math.Max(0, negative - exNegative)),
                config.Value.Ranking.ScoreLabelMinimumReviews);
        }

        var stats = await db.GameStatistics.FirstOrDefaultAsync(s => s.GameId == gameId, cancellationToken);
        if (stats is null)
        {
            stats = new GameStatisticsEntity { GameId = gameId };
            db.GameStatistics.Add(stats);
        }

        stats.TotalReviews = score.TotalReviews;
        stats.PositiveReviews = score.PositiveReviews;
        stats.NegativeReviews = score.NegativeReviews;
        stats.PositivePercentage = score.PositivePercentage;
        stats.WilsonLowerBound = score.WilsonLowerBound;
        stats.ConfidenceScore = score.ConfidenceScore;
        stats.AverageRating = averageRating;
        stats.RatingCount = ratingCount;
        stats.TotalHoursPlayed = hoursSum;
        stats.TotalReviewsExcludingBombs = excludingScore.TotalReviews;
        stats.PositiveReviewsExcludingBombs = excludingScore.PositiveReviews;
        stats.NegativeReviewsExcludingBombs = excludingScore.NegativeReviews;
        stats.PositivePercentageExcludingBombs = excludingScore.PositivePercentage;
        stats.ConfidenceScoreExcludingBombs = excludingScore.ConfidenceScore;
        stats.LastCalculatedAt = DateTime.UtcNow;

        if (includePlatforms)
        {
            await RebuildPlatformStatisticsAsync(gameId, visible, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task BumpDailyActivityAsync(
        Guid gameId,
        bool recommended,
        DateTime createdAt,
        int delta,
        CancellationToken cancellationToken = default)
    {
        var date = DateHelpers.UtcDate(createdAt);
        var existing = await db.GameActivityDaily
            .FirstOrDefaultAsync(a => a.GameId == gameId && a.Date == date, cancellationToken);

        if (existing is null)
        {
            if (delta < 0)
            {
                return;
            }

            db.GameActivityDaily.Add(new GameActivityDailyEntity
            {
                GameId = gameId,
                Date = date,
                ReviewCount = 1,
                PositiveCount = recommended ? 1 : 0,
                NegativeCount = recommended ? 0 : 1,
            });
            return;
        }

        existing.ReviewCount = Math.Max(0, existing.ReviewCount + delta);
        existing.PositiveCount = Math.Max(0, existing.PositiveCount + (recommended ? delta : 0));
        existing.NegativeCount = Math.Max(0, existing.NegativeCount + (recommended ? 0 : delta));
    }

    private async Task RebuildPlatformStatisticsAsync(
        Guid gameId,
        IQueryable<ReviewEntity> visible,
        CancellationToken cancellationToken)
    {
        await db.GameStatisticsPlatforms.Where(p => p.GameId == gameId).ExecuteDeleteAsync(cancellationToken);

        var rows = await visible
            .Where(r => r.PlatformId != null)
            .GroupBy(r => new { r.PlatformId, r.Recommended })
            .Select(g => new { g.Key.PlatformId, g.Key.Recommended, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var perPlatform = new Dictionary<Guid, (int Positive, int Negative)>();
        foreach (var row in rows)
        {
            if (row.PlatformId is null)
            {
                continue;
            }

            if (!perPlatform.TryGetValue(row.PlatformId.Value, out var counts))
            {
                counts = (0, 0);
            }

            if (row.Recommended)
            {
                counts.Positive += row.Count;
            }
            else
            {
                counts.Negative += row.Count;
            }

            perPlatform[row.PlatformId.Value] = counts;
        }

        foreach (var (platformId, counts) in perPlatform)
        {
            var platformScore = GameScoreCalculator.Calculate(new RecommendationCounts(counts.Positive, counts.Negative));
            db.GameStatisticsPlatforms.Add(new GameStatisticsPlatformEntity
            {
                GameId = gameId,
                PlatformId = platformId,
                TotalReviews = platformScore.TotalReviews,
                PositiveReviews = platformScore.PositiveReviews,
                NegativeReviews = platformScore.NegativeReviews,
                PositivePercentage = platformScore.PositivePercentage,
                ConfidenceScore = platformScore.ConfidenceScore,
                LastCalculatedAt = DateTime.UtcNow,
            });
        }
    }
}
