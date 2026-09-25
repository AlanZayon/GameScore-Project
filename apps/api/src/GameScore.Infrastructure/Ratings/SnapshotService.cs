using GameScore.Domain.Scoring;
using GameScore.Infrastructure.Crypto;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GameScore.Infrastructure.Ratings;

public sealed class ReviewBombDetectorService
{
    private readonly GameScoreDbContext _db;
    private readonly ILogger<ReviewBombDetectorService> _logger;

    public ReviewBombDetectorService(GameScoreDbContext db, ILogger<ReviewBombDetectorService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task InspectAsync(Guid gameId, string dateIso, CancellationToken cancellationToken = default)
    {
        var day = DateOnly.Parse(dateIso, System.Globalization.CultureInfo.InvariantCulture);
        var historyStart = day.AddDays(-ReviewBombDetector.BaselineWindowDays);

        var rows = await _db.GameActivityDaily.AsNoTracking()
            .Where(r => r.GameId == gameId && r.Date >= historyStart && r.Date <= day)
            .OrderBy(r => r.Date)
            .ToListAsync(cancellationToken);

        var history = rows
            .Where(row => DateHelpers.IsoDate(row.Date) != dateIso)
            .Select(row => new DailyReviewActivity(
                DateHelpers.IsoDate(row.Date),
                row.PositiveCount,
                row.NegativeCount))
            .ToList();

        var today = rows.FirstOrDefault(row => DateHelpers.IsoDate(row.Date) == dateIso);
        var assessed = ReviewBombDetector.Assess(
            new DailyReviewActivity(dateIso, today?.PositiveCount ?? 0, today?.NegativeCount ?? 0),
            history);

        if (!assessed.Anomalous || assessed.Direction == "NONE")
        {
            return;
        }

        var startAt = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endAt = day.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddMilliseconds(-1);
        var direction = assessed.Direction == "POSITIVE"
            ? DbReviewBombDirection.POSITIVE
            : DbReviewBombDirection.NEGATIVE;

        var existing = await _db.ReviewBombEvents
            .FirstOrDefaultAsync(e => e.GameId == gameId && e.StartAt == startAt, cancellationToken);

        if (existing is null)
        {
            _db.ReviewBombEvents.Add(new ReviewBombEventEntity
            {
                Id = Guid.NewGuid(),
                GameId = gameId,
                StartAt = startAt,
                EndAt = endAt,
                PositiveCount = assessed.Positive,
                NegativeCount = assessed.Negative,
                BaselinePerDay = assessed.BaselinePerDay,
                Severity = assessed.Severity,
                Direction = direction,
                Status = DbReviewBombStatus.DETECTED,
                DetectedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existing.PositiveCount = assessed.Positive;
            existing.NegativeCount = assessed.Negative;
            existing.BaselinePerDay = assessed.BaselinePerDay;
            existing.Severity = assessed.Severity;
            existing.Direction = direction;
        }

        await _db.Reviews
            .Where(r =>
                r.GameId == gameId
                && r.DeletedAt == null
                && r.CreatedAt >= startAt
                && r.CreatedAt <= endAt
                && r.ModerationStatus != DbReviewModerationStatus.REVIEW_BOMB)
            .ExecuteUpdateAsync(
                s => s.SetProperty(r => r.ModerationStatus, DbReviewModerationStatus.REVIEW_BOMB),
                cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogWarning(
            "Review bomb {Direction} detected for game {GameId} on {Date} (severity {Severity:F2})",
            assessed.Direction,
            gameId,
            dateIso,
            assessed.Severity);
    }
}

public sealed class SnapshotService
{
    private readonly GameScoreDbContext _db;
    private readonly ILogger<SnapshotService> _logger;

    public SnapshotService(GameScoreDbContext db, ILogger<SnapshotService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task SnapshotTodayAsync(CancellationToken cancellationToken = default)
    {
        var date = DateHelpers.UtcDate();
        var stats = await _db.GameStatistics.AsNoTracking().ToListAsync(cancellationToken);

        foreach (var row in stats)
        {
            var existing = await _db.GameScoreSnapshots
                .FirstOrDefaultAsync(s => s.GameId == row.GameId && s.Date == date, cancellationToken);
            if (existing is null)
            {
                _db.GameScoreSnapshots.Add(new GameScoreSnapshotEntity
                {
                    Id = Guid.NewGuid(),
                    GameId = row.GameId,
                    Date = date,
                    TotalReviews = row.TotalReviews,
                    PositiveReviews = row.PositiveReviews,
                    NegativeReviews = row.NegativeReviews,
                    PositivePercentage = row.PositivePercentage,
                    ConfidenceScore = row.ConfidenceScore,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                existing.TotalReviews = row.TotalReviews;
                existing.PositiveReviews = row.PositiveReviews;
                existing.NegativeReviews = row.NegativeReviews;
                existing.PositivePercentage = row.PositivePercentage;
                existing.ConfidenceScore = row.ConfidenceScore;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Wrote {Count} score snapshots for {Date}", stats.Count, date);
    }
}
