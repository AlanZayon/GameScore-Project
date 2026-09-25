using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GameScore.Infrastructure.Persistence;

public sealed class GameScoreDbContext(DbContextOptions<GameScoreDbContext> options) : DbContext(options)
{
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<RefreshTokenEntity> RefreshTokens => Set<RefreshTokenEntity>();
    public DbSet<PasswordResetTokenEntity> PasswordResetTokens => Set<PasswordResetTokenEntity>();
    public DbSet<EmailVerificationTokenEntity> EmailVerificationTokens => Set<EmailVerificationTokenEntity>();
    public DbSet<PlatformEntity> Platforms => Set<PlatformEntity>();
    public DbSet<GenreEntity> Genres => Set<GenreEntity>();
    public DbSet<GameEntity> Games => Set<GameEntity>();
    public DbSet<GamePlatformEntity> GamePlatforms => Set<GamePlatformEntity>();
    public DbSet<GameGenreEntity> GameGenres => Set<GameGenreEntity>();
    public DbSet<GameExternalSourceEntity> GameExternalSources => Set<GameExternalSourceEntity>();
    public DbSet<GameRelationEntity> GameRelations => Set<GameRelationEntity>();
    public DbSet<ReviewEntity> Reviews => Set<ReviewEntity>();
    public DbSet<ReviewVoteEntity> ReviewVotes => Set<ReviewVoteEntity>();
    public DbSet<ReviewReportEntity> ReviewReports => Set<ReviewReportEntity>();
    public DbSet<GameStatisticsEntity> GameStatistics => Set<GameStatisticsEntity>();
    public DbSet<GameStatisticsPlatformEntity> GameStatisticsPlatforms => Set<GameStatisticsPlatformEntity>();
    public DbSet<GameActivityDailyEntity> GameActivityDaily => Set<GameActivityDailyEntity>();
    public DbSet<GameScoreSnapshotEntity> GameScoreSnapshots => Set<GameScoreSnapshotEntity>();
    public DbSet<ReviewBombEventEntity> ReviewBombEvents => Set<ReviewBombEventEntity>();
    public DbSet<ReputationEventEntity> ReputationEvents => Set<ReputationEventEntity>();
    public DbSet<AuditLogEntity> AuditLogs => Set<AuditLogEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum<DbUserRole>();
        modelBuilder.HasPostgresEnum<DbUserStatus>();
        modelBuilder.HasPostgresEnum<DbReviewStatus>();
        modelBuilder.HasPostgresEnum<DbReviewModerationStatus>();
        modelBuilder.HasPostgresEnum<DbReportReason>();
        modelBuilder.HasPostgresEnum<DbReportStatus>();
        modelBuilder.HasPostgresEnum<DbReviewBombStatus>();
        modelBuilder.HasPostgresEnum<DbReviewBombDirection>();
        modelBuilder.HasPostgresEnum<DbExternalProvider>();
        modelBuilder.HasPostgresEnum<DbPlatformFamily>();
        modelBuilder.HasPostgresEnum<DbGameRelationKind>();
        modelBuilder.HasPostgresEnum<DbReputationReason>();
        modelBuilder.HasPostgresEnum<DbAuditAction>();

        var dateOnlyConverter = new ValueConverter<DateOnly, DateTime>(
            d => DateTime.SpecifyKind(d.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
            d => DateOnly.FromDateTime(d));

        modelBuilder.Entity<UserEntity>(e =>
        {
            e.ToTable("users");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.Username).HasColumnName("username");
            e.Property(x => x.DisplayName).HasColumnName("displayName");
            e.Property(x => x.PasswordHash).HasColumnName("passwordHash");
            e.Property(x => x.Role).HasColumnName("role");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.SuspendedUntil).HasColumnName("suspendedUntil");
            e.Property(x => x.SuspensionReason).HasColumnName("suspensionReason");
            e.Property(x => x.ReputationScore).HasColumnName("reputationScore");
            e.Property(x => x.AvatarUrl).HasColumnName("avatarUrl");
            e.Property(x => x.Bio).HasColumnName("bio");
            e.Property(x => x.EmailVerifiedAt).HasColumnName("emailVerifiedAt");
            e.Property(x => x.TermsAcceptedAt).HasColumnName("termsAcceptedAt");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
            e.Property(x => x.DeletedAt).HasColumnName("deletedAt");
        });

        modelBuilder.Entity<RefreshTokenEntity>(e =>
        {
            e.ToTable("refresh_tokens");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("userId");
            e.Property(x => x.TokenHash).HasColumnName("tokenHash");
            e.Property(x => x.ExpiresAt).HasColumnName("expiresAt");
            e.Property(x => x.RevokedAt).HasColumnName("revokedAt");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UserAgent).HasColumnName("userAgent");
            e.HasOne(x => x.User).WithMany(u => u.RefreshTokens).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<PasswordResetTokenEntity>(e =>
        {
            e.ToTable("password_reset_tokens");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("userId");
            e.Property(x => x.TokenHash).HasColumnName("tokenHash");
            e.Property(x => x.ExpiresAt).HasColumnName("expiresAt");
            e.Property(x => x.UsedAt).HasColumnName("usedAt");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<EmailVerificationTokenEntity>(e =>
        {
            e.ToTable("email_verification_tokens");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("userId");
            e.Property(x => x.TokenHash).HasColumnName("tokenHash");
            e.Property(x => x.ExpiresAt).HasColumnName("expiresAt");
            e.Property(x => x.UsedAt).HasColumnName("usedAt");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<PlatformEntity>(e =>
        {
            e.ToTable("platforms");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Slug).HasColumnName("slug");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Abbreviation).HasColumnName("abbreviation");
            e.Property(x => x.Family).HasColumnName("family");
            e.Property(x => x.SortOrder).HasColumnName("sortOrder");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<GenreEntity>(e =>
        {
            e.ToTable("genres");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Slug).HasColumnName("slug");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<GameEntity>(e =>
        {
            e.ToTable("games");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Slug).HasColumnName("slug");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Summary).HasColumnName("summary");
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.Developer).HasColumnName("developer");
            e.Property(x => x.Publisher).HasColumnName("publisher");
            e.Property(x => x.ReleaseDate).HasColumnName("releaseDate").HasConversion(dateOnlyConverter);
            e.Property(x => x.CoverImageUrl).HasColumnName("coverImageUrl");
            e.Property(x => x.BannerImageUrl).HasColumnName("bannerImageUrl");
            e.Property(x => x.TrailerYoutubeId).HasColumnName("trailerYoutubeId");
            e.Property(x => x.GalleryImageUrls).HasColumnName("galleryImageUrls");
            e.Property(x => x.ViewCount).HasColumnName("viewCount");
            e.Property(x => x.EditedFields).HasColumnName("editedFields");
            e.Property(x => x.SearchVector).HasColumnName("searchVector");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<GamePlatformEntity>(e =>
        {
            e.ToTable("game_platforms");
            e.HasKey(x => new { x.GameId, x.PlatformId });
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.PlatformId).HasColumnName("platformId");
        });

        modelBuilder.Entity<GameGenreEntity>(e =>
        {
            e.ToTable("game_genres");
            e.HasKey(x => new { x.GameId, x.GenreId });
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.GenreId).HasColumnName("genreId");
        });

        modelBuilder.Entity<GameExternalSourceEntity>(e =>
        {
            e.ToTable("game_external_sources");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.Provider).HasColumnName("provider");
            e.Property(x => x.ExternalId).HasColumnName("externalId");
            e.Property(x => x.ExternalUpdatedAt).HasColumnName("externalUpdatedAt");
            e.Property(x => x.LastSyncedAt).HasColumnName("lastSyncedAt");
            e.Property(x => x.RawPayload).HasColumnName("rawPayload").HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<GameRelationEntity>(e =>
        {
            e.ToTable("game_relations");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.Kind).HasColumnName("kind");
            e.Property(x => x.Provider).HasColumnName("provider");
            e.Property(x => x.ExternalId).HasColumnName("externalId");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.CoverImageUrl).HasColumnName("coverImageUrl");
            e.Property(x => x.ReleaseDate).HasColumnName("releaseDate").HasConversion(dateOnlyConverter);
            e.Property(x => x.RelatedGameId).HasColumnName("relatedGameId");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<ReviewEntity>(e =>
        {
            e.ToTable("reviews");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.UserId).HasColumnName("userId");
            e.Property(x => x.Recommended).HasColumnName("recommended");
            e.Property(x => x.Rating).HasColumnName("rating");
            e.Property(x => x.Text).HasColumnName("text");
            e.Property(x => x.HoursPlayed).HasColumnName("hoursPlayed");
            e.Property(x => x.PlatformId).HasColumnName("platformId");
            e.Property(x => x.UsefulCount).HasColumnName("usefulCount");
            e.Property(x => x.NotUsefulCount).HasColumnName("notUsefulCount");
            e.Property(x => x.RankingScore).HasColumnName("rankingScore");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.ModerationStatus).HasColumnName("moderationStatus");
            e.Property(x => x.ModerationNotes).HasColumnName("moderationNotes");
            e.Property(x => x.TextFingerprint).HasColumnName("textFingerprint");
            e.Property(x => x.AuthorIpHash).HasColumnName("authorIpHash");
            e.Property(x => x.Edited).HasColumnName("edited");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
            e.Property(x => x.DeletedAt).HasColumnName("deletedAt");
            e.Property(x => x.DeletedById).HasColumnName("deletedById");
            e.Property(x => x.DeletionReason).HasColumnName("deletionReason");
        });

        modelBuilder.Entity<ReviewVoteEntity>(e =>
        {
            e.ToTable("review_votes");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ReviewId).HasColumnName("reviewId");
            e.Property(x => x.UserId).HasColumnName("userId");
            e.Property(x => x.Useful).HasColumnName("useful");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
            e.HasIndex(x => new { x.UserId, x.ReviewId }).IsUnique();
        });

        modelBuilder.Entity<ReviewReportEntity>(e =>
        {
            e.ToTable("review_reports");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ReviewId).HasColumnName("reviewId");
            e.Property(x => x.ReporterId).HasColumnName("reporterId");
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.Details).HasColumnName("details");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
            e.Property(x => x.ResolvedAt).HasColumnName("resolvedAt");
            e.Property(x => x.ResolvedById).HasColumnName("resolvedById");
            e.Property(x => x.ResolutionNote).HasColumnName("resolutionNote");
        });

        modelBuilder.Entity<GameStatisticsEntity>(e =>
        {
            e.ToTable("game_statistics");
            e.HasKey(x => x.GameId);
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.TotalReviews).HasColumnName("totalReviews");
            e.Property(x => x.PositiveReviews).HasColumnName("positiveReviews");
            e.Property(x => x.NegativeReviews).HasColumnName("negativeReviews");
            e.Property(x => x.PositivePercentage).HasColumnName("positivePercentage");
            e.Property(x => x.WilsonLowerBound).HasColumnName("wilsonLowerBound");
            e.Property(x => x.ConfidenceScore).HasColumnName("confidenceScore");
            e.Property(x => x.AverageRating).HasColumnName("averageRating");
            e.Property(x => x.RatingCount).HasColumnName("ratingCount");
            e.Property(x => x.TotalReviewsExcludingBombs).HasColumnName("totalReviewsExcludingBombs");
            e.Property(x => x.PositiveReviewsExcludingBombs).HasColumnName("positiveReviewsExcludingBombs");
            e.Property(x => x.NegativeReviewsExcludingBombs).HasColumnName("negativeReviewsExcludingBombs");
            e.Property(x => x.PositivePercentageExcludingBombs).HasColumnName("positivePercentageExcludingBombs");
            e.Property(x => x.ConfidenceScoreExcludingBombs).HasColumnName("confidenceScoreExcludingBombs");
            e.Property(x => x.TotalHoursPlayed).HasColumnName("totalHoursPlayed");
            e.Property(x => x.LastCalculatedAt).HasColumnName("lastCalculatedAt");
        });

        modelBuilder.Entity<GameStatisticsPlatformEntity>(e =>
        {
            e.ToTable("game_statistics_platforms");
            e.HasKey(x => new { x.GameId, x.PlatformId });
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.PlatformId).HasColumnName("platformId");
            e.Property(x => x.TotalReviews).HasColumnName("totalReviews");
            e.Property(x => x.PositiveReviews).HasColumnName("positiveReviews");
            e.Property(x => x.NegativeReviews).HasColumnName("negativeReviews");
            e.Property(x => x.PositivePercentage).HasColumnName("positivePercentage");
            e.Property(x => x.ConfidenceScore).HasColumnName("confidenceScore");
            e.Property(x => x.LastCalculatedAt).HasColumnName("lastCalculatedAt");
        });

        modelBuilder.Entity<GameActivityDailyEntity>(e =>
        {
            e.ToTable("game_activity_daily");
            e.HasKey(x => new { x.GameId, x.Date });
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.Date).HasColumnName("date").HasConversion(dateOnlyConverter);
            e.Property(x => x.ReviewCount).HasColumnName("reviewCount");
            e.Property(x => x.PositiveCount).HasColumnName("positiveCount");
            e.Property(x => x.NegativeCount).HasColumnName("negativeCount");
            e.Property(x => x.ViewCount).HasColumnName("viewCount");
        });

        modelBuilder.Entity<GameScoreSnapshotEntity>(e =>
        {
            e.ToTable("game_score_snapshots");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.Date).HasColumnName("date").HasConversion(dateOnlyConverter);
            e.Property(x => x.TotalReviews).HasColumnName("totalReviews");
            e.Property(x => x.PositiveReviews).HasColumnName("positiveReviews");
            e.Property(x => x.NegativeReviews).HasColumnName("negativeReviews");
            e.Property(x => x.PositivePercentage).HasColumnName("positivePercentage");
            e.Property(x => x.ConfidenceScore).HasColumnName("confidenceScore");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<ReviewBombEventEntity>(e =>
        {
            e.ToTable("review_bomb_events");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GameId).HasColumnName("gameId");
            e.Property(x => x.StartAt).HasColumnName("startAt");
            e.Property(x => x.EndAt).HasColumnName("endAt");
            e.Property(x => x.PositiveCount).HasColumnName("positiveCount");
            e.Property(x => x.NegativeCount).HasColumnName("negativeCount");
            e.Property(x => x.BaselinePerDay).HasColumnName("baselinePerDay");
            e.Property(x => x.Severity).HasColumnName("severity");
            e.Property(x => x.Direction).HasColumnName("direction");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.DetectedAt).HasColumnName("detectedAt");
            e.Property(x => x.ReviewedAt).HasColumnName("reviewedAt");
            e.Property(x => x.ReviewedById).HasColumnName("reviewedById");
            e.Property(x => x.Notes).HasColumnName("notes");
        });

        modelBuilder.Entity<ReputationEventEntity>(e =>
        {
            e.ToTable("reputation_events");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("userId");
            e.Property(x => x.Delta).HasColumnName("delta");
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.BalanceAfter).HasColumnName("balanceAfter");
            e.Property(x => x.SourceType).HasColumnName("sourceType");
            e.Property(x => x.SourceId).HasColumnName("sourceId");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<AuditLogEntity>(e =>
        {
            e.ToTable("audit_logs");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ActorId).HasColumnName("actorId");
            e.Property(x => x.Action).HasColumnName("action");
            e.Property(x => x.TargetType).HasColumnName("targetType");
            e.Property(x => x.TargetId).HasColumnName("targetId");
            e.Property(x => x.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });
    }
}
