-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewModerationStatus" AS ENUM ('NORMAL', 'SUSPICIOUS', 'REVIEW_BOMB', 'MODERATION_REQUIRED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSE', 'OFF_TOPIC', 'FAKE_REVIEW', 'HARASSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewBombStatus" AS ENUM ('DETECTED', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewBombDirection" AS ENUM ('NEGATIVE', 'POSITIVE');

-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('IGDB');

-- CreateEnum
CREATE TYPE "PlatformFamily" AS ENUM ('PC', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'MOBILE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReputationReason" AS ENUM ('USEFUL_VOTE_RECEIVED', 'NOT_USEFUL_VOTE_RECEIVED', 'USEFUL_VOTE_REMOVED', 'NOT_USEFUL_VOTE_REMOVED', 'REVIEW_PUBLISHED', 'REVIEW_DELETED', 'REVIEW_REMOVED_BY_MODERATOR', 'ABUSE_CONFIRMED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ADMIN_DELETED_REVIEW', 'ADMIN_RESTORED_REVIEW', 'ADMIN_UPDATED_REVIEW_MODERATION', 'ADMIN_SUSPENDED_USER', 'ADMIN_REINSTATED_USER', 'ADMIN_UPDATED_USER_ROLE', 'ADMIN_IMPORTED_GAME', 'ADMIN_SYNCED_GAME', 'ADMIN_UPDATED_GAME', 'ADMIN_RESOLVED_REPORT', 'ADMIN_UPDATED_REVIEW_BOMB_EVENT', 'ADMIN_RECALCULATED_GAME_SCORE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "displayName" VARCHAR(50),
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedUntil" TIMESTAMP(3),
    "suspensionReason" VARCHAR(500),
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "avatarUrl" VARCHAR(1000),
    "bio" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" VARCHAR(255),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "abbreviation" VARCHAR(20) NOT NULL,
    "family" "PlatformFamily" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "summary" VARCHAR(600),
    "description" TEXT,
    "developer" VARCHAR(150),
    "publisher" VARCHAR(150),
    "releaseDate" DATE,
    "coverImageUrl" VARCHAR(1000),
    "bannerImageUrl" VARCHAR(1000),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "editedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchVector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_platforms" (
    "gameId" UUID NOT NULL,
    "platformId" UUID NOT NULL,

    CONSTRAINT "game_platforms_pkey" PRIMARY KEY ("gameId","platformId")
);

-- CreateTable
CREATE TABLE "game_genres" (
    "gameId" UUID NOT NULL,
    "genreId" UUID NOT NULL,

    CONSTRAINT "game_genres_pkey" PRIMARY KEY ("gameId","genreId")
);

-- CreateTable
CREATE TABLE "game_external_sources" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "externalId" VARCHAR(100) NOT NULL,
    "externalUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_external_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recommended" BOOLEAN NOT NULL,
    "rating" INTEGER,
    "text" TEXT NOT NULL,
    "hoursPlayed" INTEGER,
    "platformId" UUID,
    "usefulCount" INTEGER NOT NULL DEFAULT 0,
    "notUsefulCount" INTEGER NOT NULL DEFAULT 0,
    "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'NORMAL',
    "moderationNotes" VARCHAR(1000),
    "textFingerprint" VARCHAR(64),
    "authorIpHash" VARCHAR(64),
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "deletionReason" VARCHAR(500),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_votes" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "useful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "resolutionNote" VARCHAR(500),

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_statistics" (
    "gameId" UUID NOT NULL,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "positiveReviews" INTEGER NOT NULL DEFAULT 0,
    "negativeReviews" INTEGER NOT NULL DEFAULT 0,
    "positivePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wilsonLowerBound" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "totalReviewsExcludingBombs" INTEGER NOT NULL DEFAULT 0,
    "positiveReviewsExcludingBombs" INTEGER NOT NULL DEFAULT 0,
    "negativeReviewsExcludingBombs" INTEGER NOT NULL DEFAULT 0,
    "positivePercentageExcludingBombs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScoreExcludingBombs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHoursPlayed" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_statistics_pkey" PRIMARY KEY ("gameId")
);

-- CreateTable
CREATE TABLE "game_statistics_platforms" (
    "gameId" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "positiveReviews" INTEGER NOT NULL DEFAULT 0,
    "negativeReviews" INTEGER NOT NULL DEFAULT 0,
    "positivePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_statistics_platforms_pkey" PRIMARY KEY ("gameId","platformId")
);

-- CreateTable
CREATE TABLE "game_activity_daily" (
    "gameId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_activity_daily_pkey" PRIMARY KEY ("gameId","date")
);

-- CreateTable
CREATE TABLE "game_score_snapshots" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalReviews" INTEGER NOT NULL,
    "positiveReviews" INTEGER NOT NULL,
    "negativeReviews" INTEGER NOT NULL,
    "positivePercentage" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_bomb_events" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "positiveCount" INTEGER NOT NULL,
    "negativeCount" INTEGER NOT NULL,
    "baselinePerDay" DOUBLE PRECISION NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "direction" "ReviewBombDirection" NOT NULL DEFAULT 'NEGATIVE',
    "status" "ReviewBombStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "notes" VARCHAR(1000),

    CONSTRAINT "review_bomb_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "ReputationReason" NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" VARCHAR(40),
    "sourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" "AuditAction" NOT NULL,
    "targetType" VARCHAR(40) NOT NULL,
    "targetId" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_reputationScore_idx" ON "users"("reputationScore" DESC);

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "platforms_family_idx" ON "platforms"("family");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

-- CreateIndex
CREATE INDEX "games_name_idx" ON "games"("name");

-- CreateIndex
CREATE INDEX "games_releaseDate_idx" ON "games"("releaseDate" DESC);

-- CreateIndex
CREATE INDEX "games_createdAt_idx" ON "games"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "game_platforms_platformId_idx" ON "game_platforms"("platformId");

-- CreateIndex
CREATE INDEX "game_genres_genreId_idx" ON "game_genres"("genreId");

-- CreateIndex
CREATE INDEX "game_external_sources_gameId_idx" ON "game_external_sources"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "game_external_sources_provider_externalId_key" ON "game_external_sources"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "game_external_sources_gameId_provider_key" ON "game_external_sources"("gameId", "provider");

-- CreateIndex
CREATE INDEX "reviews_gameId_createdAt_idx" ON "reviews"("gameId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_gameId_rankingScore_idx" ON "reviews"("gameId", "rankingScore" DESC);

-- CreateIndex
CREATE INDEX "reviews_gameId_recommended_idx" ON "reviews"("gameId", "recommended");

-- CreateIndex
CREATE INDEX "reviews_gameId_platformId_idx" ON "reviews"("gameId", "platformId");

-- CreateIndex
CREATE INDEX "reviews_userId_createdAt_idx" ON "reviews"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_createdAt_idx" ON "reviews"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_status_moderationStatus_idx" ON "reviews"("status", "moderationStatus");

-- CreateIndex
CREATE INDEX "reviews_textFingerprint_idx" ON "reviews"("textFingerprint");

-- CreateIndex
CREATE INDEX "review_votes_reviewId_idx" ON "review_votes"("reviewId");

-- CreateIndex
CREATE INDEX "review_votes_userId_idx" ON "review_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "review_votes_userId_reviewId_key" ON "review_votes"("userId", "reviewId");

-- CreateIndex
CREATE INDEX "review_reports_status_createdAt_idx" ON "review_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "review_reports_reviewId_idx" ON "review_reports"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_reviewId_reporterId_key" ON "review_reports"("reviewId", "reporterId");

-- CreateIndex
CREATE INDEX "game_statistics_confidenceScore_idx" ON "game_statistics"("confidenceScore" DESC);

-- CreateIndex
CREATE INDEX "game_statistics_totalReviews_idx" ON "game_statistics"("totalReviews" DESC);

-- CreateIndex
CREATE INDEX "game_statistics_positivePercentage_idx" ON "game_statistics"("positivePercentage" DESC);

-- CreateIndex
CREATE INDEX "game_statistics_platforms_platformId_idx" ON "game_statistics_platforms"("platformId");

-- CreateIndex
CREATE INDEX "game_activity_daily_date_idx" ON "game_activity_daily"("date");

-- CreateIndex
CREATE INDEX "game_score_snapshots_date_idx" ON "game_score_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "game_score_snapshots_gameId_date_key" ON "game_score_snapshots"("gameId", "date");

-- CreateIndex
CREATE INDEX "review_bomb_events_gameId_status_idx" ON "review_bomb_events"("gameId", "status");

-- CreateIndex
CREATE INDEX "review_bomb_events_status_severity_idx" ON "review_bomb_events"("status", "severity" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "review_bomb_events_gameId_startAt_key" ON "review_bomb_events"("gameId", "startAt");

-- CreateIndex
CREATE INDEX "reputation_events_userId_createdAt_idx" ON "reputation_events"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_genres" ADD CONSTRAINT "game_genres_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_genres" ADD CONSTRAINT "game_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_external_sources" ADD CONSTRAINT "game_external_sources_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_statistics" ADD CONSTRAINT "game_statistics_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_statistics_platforms" ADD CONSTRAINT "game_statistics_platforms_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_statistics_platforms" ADD CONSTRAINT "game_statistics_platforms_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_activity_daily" ADD CONSTRAINT "game_activity_daily_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_score_snapshots" ADD CONSTRAINT "game_score_snapshots_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_bomb_events" ADD CONSTRAINT "review_bomb_events_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_bomb_events" ADD CONSTRAINT "review_bomb_events_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- Everything below is hand written because the Prisma schema language cannot
-- express it. See docs/database.md.
-- ===========================================================================

-- Trigram matching powers fuzzy search and the "zel" -> "Zelda" autocomplete.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full text search document, maintained by PostgreSQL itself so it can never
-- drift from the row. The 'simple' dictionary is deliberate: game titles are
-- proper nouns in many languages and stemming them does more harm than good.
ALTER TABLE "games" DROP COLUMN "searchVector";
ALTER TABLE "games"
    ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(replace("slug", '-', ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce("developer", '')), 'C') ||
        setweight(to_tsvector('simple', coalesce("publisher", '')), 'C') ||
        setweight(to_tsvector('simple', coalesce("summary", '')), 'D')
    ) STORED;

CREATE INDEX "games_searchVector_idx" ON "games" USING GIN ("searchVector");

-- Prefix and typo tolerant matching on the name, used by autocomplete.
CREATE INDEX "games_name_trgm_idx" ON "games" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX "games_developer_trgm_idx" ON "games" USING GIN (lower(coalesce("developer", '')) gin_trgm_ops);
CREATE INDEX "games_publisher_trgm_idx" ON "games" USING GIN (lower(coalesce("publisher", '')) gin_trgm_ops);

-- One active review per user per game. A plain UNIQUE constraint would also
-- count soft-deleted rows and permanently block the user from reviewing that
-- game again, so the constraint has to ignore them.
CREATE UNIQUE INDEX "reviews_userId_gameId_active_key"
    ON "reviews" ("userId", "gameId")
    WHERE "deletedAt" IS NULL;

-- The review list is always filtered to visible reviews, so the indexes that
-- serve it are partial too: smaller, and they match the query exactly.
CREATE INDEX "reviews_game_visible_ranking_idx"
    ON "reviews" ("gameId", "rankingScore" DESC, "id")
    WHERE "deletedAt" IS NULL AND "status" = 'PUBLISHED';

CREATE INDEX "reviews_game_visible_recent_idx"
    ON "reviews" ("gameId", "createdAt" DESC, "id")
    WHERE "deletedAt" IS NULL AND "status" = 'PUBLISHED';

CREATE INDEX "reviews_game_visible_useful_idx"
    ON "reviews" ("gameId", "usefulCount" DESC, "id")
    WHERE "deletedAt" IS NULL AND "status" = 'PUBLISHED';

-- Anti-spam lookups: recent reviews by one author, and repeated bodies.
CREATE INDEX "reviews_author_recent_idx"
    ON "reviews" ("userId", "createdAt" DESC)
    WHERE "deletedAt" IS NULL;

CREATE INDEX "reviews_ipHash_recent_idx"
    ON "reviews" ("authorIpHash", "createdAt" DESC)
    WHERE "authorIpHash" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Integrity constraints. The application validates all of this too, but the
-- database is the last line of defence and the only one that cannot be skipped.
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
    ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email")),
    ADD CONSTRAINT "users_username_format_check" CHECK ("username" ~ '^[a-z0-9_]{3,30}$'),
    ADD CONSTRAINT "users_reputation_range_check" CHECK ("reputationScore" >= 0 AND "reputationScore" <= 5000);

ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_rating_range_check" CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 10)),
    ADD CONSTRAINT "reviews_hours_range_check" CHECK ("hoursPlayed" IS NULL OR ("hoursPlayed" >= 0 AND "hoursPlayed" <= 100000)),
    ADD CONSTRAINT "reviews_text_not_blank_check" CHECK (length(btrim("text")) > 0),
    ADD CONSTRAINT "reviews_vote_counts_check" CHECK ("usefulCount" >= 0 AND "notUsefulCount" >= 0),
    ADD CONSTRAINT "reviews_deletion_consistency_check" CHECK (
        ("deletedAt" IS NULL AND "deletionReason" IS NULL AND "deletedById" IS NULL)
        OR "deletedAt" IS NOT NULL
    );

ALTER TABLE "game_statistics"
    ADD CONSTRAINT "game_statistics_totals_check" CHECK (
        "totalReviews" = "positiveReviews" + "negativeReviews"
        AND "positiveReviews" >= 0
        AND "negativeReviews" >= 0
    ),
    ADD CONSTRAINT "game_statistics_percentage_check" CHECK ("positivePercentage" >= 0 AND "positivePercentage" <= 100),
    ADD CONSTRAINT "game_statistics_confidence_check" CHECK ("confidenceScore" >= 0 AND "confidenceScore" <= 100),
    ADD CONSTRAINT "game_statistics_rating_check" CHECK ("averageRating" IS NULL OR ("averageRating" >= 0 AND "averageRating" <= 10));

ALTER TABLE "game_statistics_platforms"
    ADD CONSTRAINT "game_statistics_platforms_totals_check" CHECK (
        "totalReviews" = "positiveReviews" + "negativeReviews"
    ),
    ADD CONSTRAINT "game_statistics_platforms_percentage_check" CHECK ("positivePercentage" >= 0 AND "positivePercentage" <= 100);

ALTER TABLE "review_bomb_events"
    ADD CONSTRAINT "review_bomb_events_window_check" CHECK ("endAt" >= "startAt"),
    ADD CONSTRAINT "review_bomb_events_severity_check" CHECK ("severity" >= 0 AND "severity" <= 1),
    ADD CONSTRAINT "review_bomb_events_counts_check" CHECK ("positiveCount" >= 0 AND "negativeCount" >= 0);

ALTER TABLE "game_activity_daily"
    ADD CONSTRAINT "game_activity_daily_counts_check" CHECK (
        "reviewCount" >= 0 AND "positiveCount" >= 0 AND "negativeCount" >= 0 AND "viewCount" >= 0
        AND "reviewCount" = "positiveCount" + "negativeCount"
    );

ALTER TABLE "games"
    ADD CONSTRAINT "games_view_count_check" CHECK ("viewCount" >= 0);
