/**
 * Domain enumerations shared by the API and the web app.
 *
 * These mirror the Prisma enums one-for-one by string value. The web app must
 * never import the Prisma client, so the values live here and the API maps
 * between the two at its boundary.
 */

export const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Publication state of a review. */
export const REVIEW_STATUSES = ['PUBLISHED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Anti-spam / moderation classification attached to a review. */
export const REVIEW_MODERATION_STATUSES = [
  'NORMAL',
  'SUSPICIOUS',
  'REVIEW_BOMB',
  'MODERATION_REQUIRED',
] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const REPORT_REASONS = [
  'SPAM',
  'ABUSE',
  'OFF_TOPIC',
  'FAKE_REVIEW',
  'HARASSMENT',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REVIEW_BOMB_STATUSES = ['DETECTED', 'CONFIRMED', 'DISMISSED'] as const;
export type ReviewBombStatus = (typeof REVIEW_BOMB_STATUSES)[number];

export const EXTERNAL_PROVIDERS = ['IGDB'] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];

/** Coarse grouping used to aggregate per-platform statistics in the UI. */
export const PLATFORM_FAMILIES = [
  'PC',
  'PLAYSTATION',
  'XBOX',
  'NINTENDO',
  'MOBILE',
  'OTHER',
] as const;
export type PlatformFamily = (typeof PLATFORM_FAMILIES)[number];

/** Sort options offered on the review list. */
export const REVIEW_SORTS = ['BEST', 'RECENT', 'MOST_USEFUL'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

/** Recommendation filter offered on the review list. */
export const REVIEW_RECOMMENDATION_FILTERS = ['ALL', 'POSITIVE', 'NEGATIVE'] as const;
export type ReviewRecommendationFilter = (typeof REVIEW_RECOMMENDATION_FILTERS)[number];

export const GAME_SORTS = ['RELEVANCE', 'TOP_RATED', 'POPULAR', 'RECENT', 'NAME'] as const;
export type GameSort = (typeof GAME_SORTS)[number];

export const AUDIT_ACTIONS = [
  'ADMIN_DELETED_REVIEW',
  'ADMIN_RESTORED_REVIEW',
  'ADMIN_UPDATED_REVIEW_MODERATION',
  'ADMIN_SUSPENDED_USER',
  'ADMIN_REINSTATED_USER',
  'ADMIN_UPDATED_USER_ROLE',
  'ADMIN_IMPORTED_GAME',
  'ADMIN_SYNCED_GAME',
  'ADMIN_UPDATED_GAME',
  'ADMIN_RESOLVED_REPORT',
  'ADMIN_UPDATED_REVIEW_BOMB_EVENT',
  'ADMIN_RECALCULATED_GAME_SCORE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt-BR';
