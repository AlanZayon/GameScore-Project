using GameScore.Infrastructure.Auth;
using GameScore.Infrastructure.Rankings;
using GameScore.Infrastructure.Ratings;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GameScore.Infrastructure.Jobs;

public static class JobNames
{
    public const string RecalculateGameScore = "ratings.recalculate-game";
    public const string DetectReviewBomb = "reviews.detect-bomb";
    public const string RecordGameView = "games.record-view";
    public const string SnapshotScores = "ratings.snapshot-scores";
    public const string Maintenance = "system.maintenance";
    public const string InvalidateRankings = "rankings.invalidate";
}

public sealed class BackgroundJobScheduler(IBackgroundJobClient jobs, ILogger<BackgroundJobScheduler> logger)
{
    public void EnqueueRecalculateGameScore(Guid gameId) =>
        TryEnqueue(JobNames.RecalculateGameScore, () =>
            jobs.Enqueue<BackgroundJobRunner>(r => r.RecalculateGameScoreAsync(gameId, CancellationToken.None)));

    public void EnqueueDetectReviewBomb(Guid gameId, string dateIso) =>
        TryEnqueue(JobNames.DetectReviewBomb, () =>
            jobs.Enqueue<BackgroundJobRunner>(r => r.DetectReviewBombAsync(gameId, dateIso, CancellationToken.None)));

    public void EnqueueRecordGameView(Guid gameId) =>
        TryEnqueue(JobNames.RecordGameView, () =>
            jobs.Enqueue<BackgroundJobRunner>(r => r.RecordGameViewAsync(gameId, CancellationToken.None)));

    public void EnqueueInvalidateRankings() =>
        TryEnqueue(JobNames.InvalidateRankings, () =>
            jobs.Enqueue<BackgroundJobRunner>(r => r.InvalidateRankingsAsync(CancellationToken.None)));

    public void EnqueueSnapshotScores() =>
        TryEnqueue(JobNames.SnapshotScores, () =>
            jobs.Enqueue<BackgroundJobRunner>(r => r.SnapshotScoresAsync(CancellationToken.None)));

    public void EnqueueMaintenance() =>
        TryEnqueue(JobNames.Maintenance, () =>
            jobs.Enqueue<BackgroundJobRunner>(r => r.MaintenanceAsync(CancellationToken.None)));

    private void TryEnqueue(string jobName, Action enqueue)
    {
        try
        {
            enqueue();
        }
        catch (Exception ex)
        {
            // Never fail an already-committed HTTP request because Hangfire/Redis is down.
            logger.LogWarning(ex, "Failed to enqueue background job {JobName}", jobName);
        }
    }
}

public sealed class BackgroundJobRunner
{
    private readonly ScoreRecalculationService _scores;
    private readonly RankingsService _rankings;
    private readonly Persistence.GameScoreDbContext _db;
    private readonly Auth.TokenService _tokens;
    private readonly ReviewBombDetectorService _reviewBombs;
    private readonly SnapshotService _snapshots;

    public BackgroundJobRunner(
        ScoreRecalculationService scores,
        RankingsService rankings,
        Persistence.GameScoreDbContext db,
        TokenService tokens,
        ReviewBombDetectorService reviewBombs,
        SnapshotService snapshots)
    {
        _scores = scores;
        _rankings = rankings;
        _db = db;
        _tokens = tokens;
        _reviewBombs = reviewBombs;
        _snapshots = snapshots;
    }

    [JobDisplayName(JobNames.RecalculateGameScore)]
    public async Task RecalculateGameScoreAsync(Guid gameId, CancellationToken cancellationToken)
    {
        await _scores.RecalculateAsync(gameId, cancellationToken: cancellationToken);
        await _rankings.InvalidateRankingsAsync(cancellationToken);
    }

    [JobDisplayName(JobNames.DetectReviewBomb)]
    public Task DetectReviewBombAsync(Guid gameId, string dateIso, CancellationToken cancellationToken) =>
        _reviewBombs.InspectAsync(gameId, dateIso, cancellationToken);

    [JobDisplayName(JobNames.RecordGameView)]
    public async Task RecordGameViewAsync(Guid gameId, CancellationToken cancellationToken)
    {
        await _db.Games.Where(g => g.Id == gameId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.ViewCount, g => g.ViewCount + 1), cancellationToken);
    }

    [JobDisplayName(JobNames.InvalidateRankings)]
    public Task InvalidateRankingsAsync(CancellationToken cancellationToken) =>
        _rankings.InvalidateRankingsAsync(cancellationToken);

    [JobDisplayName(JobNames.SnapshotScores)]
    public Task SnapshotScoresAsync(CancellationToken cancellationToken) =>
        _snapshots.SnapshotTodayAsync(cancellationToken);

    [JobDisplayName(JobNames.Maintenance)]
    public async Task MaintenanceAsync(CancellationToken cancellationToken)
    {
        await _tokens.DeleteExpiredTokensAsync(cancellationToken);
    }
}
