using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Domain.Moderation;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Reviews;

public sealed class AntiSpamService(GameScoreDbContext db, IOptions<AppConfig> config)
{
    public async Task<DbReviewModerationStatus> InspectAsync(
        AntiSpamInput input,
        CancellationToken cancellationToken = default)
    {
        var antiSpam = config.Value.AntiSpam;
        var text = input.Text.Trim();

        if (text.Length < antiSpam.MinimumTextLength)
        {
            throw new BadRequestException(
                ErrorCodes.ReviewRejectedAsSpam,
                $"Reviews must be at least {antiSpam.MinimumTextLength} characters");
        }

        if (TextHelpers.WordCount(text) < 4)
        {
            throw new BadRequestException(ErrorCodes.ReviewRejectedAsSpam, "Review text is too short");
        }

        if (TextHelpers.CharacterDiversity(text) < 0.15)
        {
            throw new BadRequestException(
                ErrorCodes.ReviewRejectedAsSpam,
                "Review text looks like padding or spam");
        }

        var hourAgo = DateTime.UtcNow.AddHours(-1);
        var dayAgo = DateTime.UtcNow.AddDays(-1);

        var hourCount = input.SkipRateLimits
            ? 0
            : await db.Reviews.CountAsync(
                r => r.UserId == input.UserId && r.CreatedAt >= hourAgo && r.DeletedAt == null,
                cancellationToken);

        var dayCount = input.SkipRateLimits
            ? 0
            : await db.Reviews.CountAsync(
                r => r.UserId == input.UserId && r.CreatedAt >= dayAgo && r.DeletedAt == null,
                cancellationToken);

        var duplicateCount = await db.Reviews.CountAsync(
            r =>
                r.TextFingerprint == input.Fingerprint
                && r.CreatedAt >= dayAgo
                && r.UserId != input.UserId
                && (input.ExcludeReviewId == null || r.Id != input.ExcludeReviewId),
            cancellationToken);

        var ipAccounts = !input.SkipRateLimits && input.IpHash is not null
            ? await db.Reviews
                .Where(r => r.AuthorIpHash == input.IpHash && r.CreatedAt >= dayAgo)
                .Select(r => r.UserId)
                .Distinct()
                .CountAsync(cancellationToken)
            : 0;

        if (!input.SkipRateLimits && (hourCount >= antiSpam.MaxReviewsPerHour || dayCount >= antiSpam.MaxReviewsPerDay))
        {
            throw new TooManyRequestsException(
                ErrorCodes.ReviewRateLimitExceeded,
                "You are posting reviews too quickly");
        }

        if (duplicateCount >= 2)
        {
            throw new BadRequestException(
                ErrorCodes.ReviewRejectedAsSpam,
                "This review text has already been posted recently");
        }

        var moderationStatus = DbReviewModerationStatus.NORMAL;
        if (TextHelpers.ShoutingRatio(text) > 0.7 || duplicateCount > 0)
        {
            moderationStatus = DbReviewModerationStatus.SUSPICIOUS;
        }

        if (!input.SkipRateLimits && input.IpHash is not null && ipAccounts >= antiSpam.MaxAccountsPerIp)
        {
            moderationStatus = DbReviewModerationStatus.MODERATION_REQUIRED;
        }

        return moderationStatus;
    }
}

public sealed record AntiSpamInput(
    Guid UserId,
    string Text,
    string Fingerprint,
    string? IpHash,
    bool SkipRateLimits = false,
    Guid? ExcludeReviewId = null);
