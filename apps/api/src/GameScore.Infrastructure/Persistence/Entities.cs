using NpgsqlTypes;

namespace GameScore.Infrastructure.Persistence;

public enum DbUserRole
{
    USER,
    MODERATOR,
    ADMIN,
}

public enum DbUserStatus
{
    ACTIVE,
    SUSPENDED,
}

public enum DbReviewStatus
{
    PUBLISHED,
    HIDDEN,
}

public enum DbReviewModerationStatus
{
    NORMAL,
    SUSPICIOUS,
    REVIEW_BOMB,
    MODERATION_REQUIRED,
}

public enum DbReportReason
{
    SPAM,
    ABUSE,
    OFF_TOPIC,
    FAKE_REVIEW,
    HARASSMENT,
    OTHER,
}

public enum DbReportStatus
{
    PENDING,
    RESOLVED,
    DISMISSED,
}

public enum DbReviewBombStatus
{
    DETECTED,
    CONFIRMED,
    DISMISSED,
}

public enum DbReviewBombDirection
{
    NEGATIVE,
    POSITIVE,
}

public enum DbExternalProvider
{
    IGDB,
}

public enum DbPlatformFamily
{
    PC,
    PLAYSTATION,
    XBOX,
    NINTENDO,
    MOBILE,
    OTHER,
}

public enum DbGameRelationKind
{
    DLC,
    EXPANSION,
    BUNDLE,
    SIMILAR,
}

public enum DbReputationReason
{
    USEFUL_VOTE_RECEIVED,
    NOT_USEFUL_VOTE_RECEIVED,
    USEFUL_VOTE_REMOVED,
    NOT_USEFUL_VOTE_REMOVED,
    REVIEW_PUBLISHED,
    REVIEW_DELETED,
    REVIEW_REMOVED_BY_MODERATOR,
    ABUSE_CONFIRMED,
}

public enum DbAuditAction
{
    ADMIN_DELETED_REVIEW,
    ADMIN_RESTORED_REVIEW,
    ADMIN_UPDATED_REVIEW_MODERATION,
    ADMIN_SUSPENDED_USER,
    ADMIN_REINSTATED_USER,
    ADMIN_UPDATED_USER_ROLE,
    ADMIN_IMPORTED_GAME,
    ADMIN_SYNCED_GAME,
    ADMIN_UPDATED_GAME,
    ADMIN_RESOLVED_REPORT,
    ADMIN_UPDATED_REVIEW_BOMB_EVENT,
    ADMIN_RECALCULATED_GAME_SCORE,
}

public sealed class UserEntity
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string Username { get; set; } = "";
    public string? DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public DbUserRole Role { get; set; }
    public DbUserStatus Status { get; set; }
    public DateTime? SuspendedUntil { get; set; }
    public string? SuspensionReason { get; set; }
    public int ReputationScore { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public DateTime? EmailVerifiedAt { get; set; }
    public DateTime? TermsAcceptedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public ICollection<RefreshTokenEntity> RefreshTokens { get; set; } = [];
    public ICollection<ReviewEntity> Reviews { get; set; } = [];
}

public sealed class RefreshTokenEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? UserAgent { get; set; }
    public UserEntity User { get; set; } = null!;
}

public sealed class PasswordResetTokenEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public UserEntity User { get; set; } = null!;
}

public sealed class EmailVerificationTokenEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public UserEntity User { get; set; } = null!;
}

public sealed class PlatformEntity
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public string Abbreviation { get; set; } = "";
    public DbPlatformFamily Family { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class GenreEntity
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class GameEntity
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Summary { get; set; }
    public string? Description { get; set; }
    public string? Developer { get; set; }
    public string? Publisher { get; set; }
    public DateOnly? ReleaseDate { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? TrailerYoutubeId { get; set; }
    public string[] GalleryImageUrls { get; set; } = [];
    public int ViewCount { get; set; }
    public string[] EditedFields { get; set; } = [];
    public NpgsqlTsVector? SearchVector { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public GameStatisticsEntity? Statistics { get; set; }
    public ICollection<GamePlatformEntity> Platforms { get; set; } = [];
    public ICollection<GameGenreEntity> Genres { get; set; } = [];
    public ICollection<GameExternalSourceEntity> ExternalSources { get; set; } = [];
}

public sealed class GamePlatformEntity
{
    public Guid GameId { get; set; }
    public Guid PlatformId { get; set; }
    public GameEntity Game { get; set; } = null!;
    public PlatformEntity Platform { get; set; } = null!;
}

public sealed class GameGenreEntity
{
    public Guid GameId { get; set; }
    public Guid GenreId { get; set; }
    public GameEntity Game { get; set; } = null!;
    public GenreEntity Genre { get; set; } = null!;
}

public sealed class GameExternalSourceEntity
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public DbExternalProvider Provider { get; set; }
    public string ExternalId { get; set; } = "";
    public DateTime? ExternalUpdatedAt { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public string? RawPayload { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public GameEntity Game { get; set; } = null!;
}

public sealed class GameRelationEntity
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public DbGameRelationKind Kind { get; set; }
    public DbExternalProvider Provider { get; set; }
    public string ExternalId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? CoverImageUrl { get; set; }
    public DateOnly? ReleaseDate { get; set; }
    public Guid? RelatedGameId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class ReviewEntity
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public Guid UserId { get; set; }
    public bool Recommended { get; set; }
    public int? Rating { get; set; }
    public string Text { get; set; } = "";
    public int? HoursPlayed { get; set; }
    public Guid? PlatformId { get; set; }
    public int UsefulCount { get; set; }
    public int NotUsefulCount { get; set; }
    public double RankingScore { get; set; }
    public DbReviewStatus Status { get; set; }
    public DbReviewModerationStatus ModerationStatus { get; set; }
    public string? ModerationNotes { get; set; }
    public string? TextFingerprint { get; set; }
    public string? AuthorIpHash { get; set; }
    public bool Edited { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedById { get; set; }
    public string? DeletionReason { get; set; }

    public GameEntity Game { get; set; } = null!;
    public UserEntity User { get; set; } = null!;
    public PlatformEntity? Platform { get; set; }
}

public sealed class ReviewVoteEntity
{
    public Guid Id { get; set; }
    public Guid ReviewId { get; set; }
    public Guid UserId { get; set; }
    public bool Useful { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ReviewEntity Review { get; set; } = null!;
    public UserEntity User { get; set; } = null!;
}

public sealed class ReviewReportEntity
{
    public Guid Id { get; set; }
    public Guid ReviewId { get; set; }
    public Guid ReporterId { get; set; }
    public DbReportReason Reason { get; set; }
    public string? Details { get; set; }
    public DbReportStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedById { get; set; }
    public string? ResolutionNote { get; set; }
}

public sealed class GameStatisticsEntity
{
    public Guid GameId { get; set; }
    public int TotalReviews { get; set; }
    public int PositiveReviews { get; set; }
    public int NegativeReviews { get; set; }
    public double PositivePercentage { get; set; }
    public double WilsonLowerBound { get; set; }
    public double ConfidenceScore { get; set; }
    public double? AverageRating { get; set; }
    public int RatingCount { get; set; }
    public int TotalReviewsExcludingBombs { get; set; }
    public int PositiveReviewsExcludingBombs { get; set; }
    public int NegativeReviewsExcludingBombs { get; set; }
    public double PositivePercentageExcludingBombs { get; set; }
    public double ConfidenceScoreExcludingBombs { get; set; }
    public int TotalHoursPlayed { get; set; }
    public DateTime LastCalculatedAt { get; set; }
    public GameEntity Game { get; set; } = null!;
}

public sealed class GameStatisticsPlatformEntity
{
    public Guid GameId { get; set; }
    public Guid PlatformId { get; set; }
    public int TotalReviews { get; set; }
    public int PositiveReviews { get; set; }
    public int NegativeReviews { get; set; }
    public double PositivePercentage { get; set; }
    public double ConfidenceScore { get; set; }
    public DateTime LastCalculatedAt { get; set; }
}

public sealed class GameActivityDailyEntity
{
    public Guid GameId { get; set; }
    public DateOnly Date { get; set; }
    public int ReviewCount { get; set; }
    public int PositiveCount { get; set; }
    public int NegativeCount { get; set; }
    public int ViewCount { get; set; }
}

public sealed class GameScoreSnapshotEntity
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public DateOnly Date { get; set; }
    public int TotalReviews { get; set; }
    public int PositiveReviews { get; set; }
    public int NegativeReviews { get; set; }
    public double PositivePercentage { get; set; }
    public double ConfidenceScore { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class ReviewBombEventEntity
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public int PositiveCount { get; set; }
    public int NegativeCount { get; set; }
    public double BaselinePerDay { get; set; }
    public double Severity { get; set; }
    public DbReviewBombDirection Direction { get; set; }
    public DbReviewBombStatus Status { get; set; }
    public DateTime DetectedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedById { get; set; }
    public string? Notes { get; set; }
}

public sealed class ReputationEventEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int Delta { get; set; }
    public DbReputationReason Reason { get; set; }
    public int BalanceAfter { get; set; }
    public string? SourceType { get; set; }
    public Guid? SourceId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class AuditLogEntity
{
    public Guid Id { get; set; }
    public Guid? ActorId { get; set; }
    public DbAuditAction Action { get; set; }
    public string TargetType { get; set; } = "";
    public string TargetId { get; set; } = "";
    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }
}
