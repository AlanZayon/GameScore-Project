using GameScore.Domain.Scoring;
using GameScore.Infrastructure.Cache;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GameScore.Infrastructure.Ratings;

public sealed class ReputationService(GameScoreDbContext db, CacheService cache)
{
    public const string UserStatsCachePrefix = "user-stats:";

    public int ApplyToUser(UserEntity user, string reason, string sourceType, Guid sourceId)
    {
        var next = Reputation.ApplyDelta(user.ReputationScore, reason);
        var delta = next - user.ReputationScore;
        user.ReputationScore = next;
        user.UpdatedAt = DateTime.UtcNow;

        db.ReputationEvents.Add(new ReputationEventEntity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Delta = delta,
            Reason = Enum.Parse<DbReputationReason>(reason),
            BalanceAfter = next,
            SourceType = sourceType,
            SourceId = sourceId,
            CreatedAt = DateTime.UtcNow,
        });

        return next;
    }

    public async Task<int> ApplyAsync(
        Guid userId,
        string reason,
        string sourceType,
        Guid sourceId,
        CancellationToken cancellationToken = default)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId, cancellationToken);
        var next = ApplyToUser(user, reason, sourceType, sourceId);
        await db.SaveChangesAsync(cancellationToken);
        return next;
    }

    public Task InvalidateUserStatsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        cache.RemoveByPrefixAsync($"{UserStatsCachePrefix}{userId}", cancellationToken);
}

public sealed class ReviewRankingService
{
    public double Score(
        int usefulVotes,
        int notUsefulVotes,
        int authorReputation,
        int textLength,
        int? hoursPlayed,
        int? rating,
        DateTime createdAt)
    {
        var ageInDays = Math.Max(0, (DateTime.UtcNow - createdAt).TotalDays);
        return ReviewScoreCalculator.CalculateValue(new ReviewScoreInput(
            usefulVotes,
            notUsefulVotes,
            authorReputation,
            textLength,
            hoursPlayed,
            rating,
            ageInDays));
    }
}
