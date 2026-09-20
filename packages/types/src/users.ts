import type { ReputationReason, ReputationTier, UserRole, UserStatus } from '@gamescore/shared';

/** Minimal user representation, safe to embed anywhere (never includes email). */
export interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  role: UserRole;
  /** True after the account has been anonymised. Reviews may still exist. */
  deleted: boolean;
}

/** Time window applied to profile analytics series. */
export type UserStatisticsRange = '3m' | '12m' | 'all';

export interface UserCategoryBreakdownDto {
  /** Genre/platform slug, or `unspecified` when the review has no platform. */
  key: string;
  name: string;
  reviewCount: number;
  recommendedCount: number;
  recommendationPercentage: number;
}

export interface UserTimelinePointDto {
  /** ISO date (day or month bucket start). */
  date: string;
  reviews: number;
  recommendedCount: number;
  recommendationPercentage: number;
  /** End-of-bucket reputation balance when known; null when no events that day. */
  reputationScore: number | null;
}

export interface UserHoursBucketDto {
  bucket: string;
  count: number;
  recommendedCount: number;
  notRecommendedCount: number;
}

export interface UserReputationBreakdownDto {
  usefulVotesReceived: number;
  notUsefulVotesReceived: number;
  reviewsPublished: number;
  reviewsDeleted: number;
  /** Present only for moderator/admin viewers. */
  moderationPenalties?: number;
}

export interface UserReputationSummaryDto {
  score: number;
  tier: ReputationTier;
  /** 0..1 against the review-ranking soft cap (500). */
  rankingWeightRatio: number;
  breakdown: UserReputationBreakdownDto;
  /**
   * Net delta from sensitive moderation events, exposed to the public so the
   * ledger can still reconcile without revealing individual penalties.
   * Null when there is nothing to hide or the viewer is staff.
   */
  moderationNet: number | null;
}

export interface UserTopReviewDto {
  id: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  gameCoverImageUrl: string | null;
  recommended: boolean;
  usefulCount: number;
  notUsefulCount: number;
  textPreview: string;
  createdAt: string;
}

export interface UserActivityDto {
  activeMonths: number;
  reviewsPerMonth: number;
}

export interface UserStatisticsDto {
  username: string;
  range: UserStatisticsRange;
  /** Published reviews in the selected range (all-time sample when range=all). */
  sampleSize: number;
  /** False when the user has fewer than 3 published reviews overall. */
  analyticsAvailable: boolean;
  recommendedCount: number;
  notRecommendedCount: number;
  recommendationPercentage: number;
  /** Site-wide recommendation % among published reviews (for comparison). */
  siteRecommendationPercentage: number;
  /**
   * useful / (useful + notUseful) across this user's published reviews,
   * 0..100. Null when nobody has voted.
   */
  usefulRate: number | null;
  totalHoursPlayed: number;
  averageHoursPlayed: number | null;
  gamesReviewed: number;
  byGenre: UserCategoryBreakdownDto[];
  byPlatform: UserCategoryBreakdownDto[];
  timeline: UserTimelinePointDto[];
  hoursPlayedDistribution: UserHoursBucketDto[];
  reputation: UserReputationSummaryDto;
  topUsefulReviews: UserTopReviewDto[];
  activity: UserActivityDto;
}

export interface ReputationEventDto {
  id: string;
  reason: ReputationReason;
  delta: number;
  balanceAfter: number;
  createdAt: string;
}

/** The authenticated user's own account. Includes private fields. */
export interface AuthenticatedUser extends UserSummary {
  email: string;
  status: UserStatus;
  createdAt: string;
  emailVerified: boolean;
}

export interface UpdateProfileRequest {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface UserProfile extends UserSummary {
  bio: string | null;
  createdAt: string;
  stats: UserProfileStats;
}

export interface DeleteAccountRequest {
  password: string;
}

export interface AccountExportReview {
  id: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  recommended: boolean;
  rating: number | null;
  text: string;
  hoursPlayed: number | null;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface AccountExportVote {
  reviewId: string;
  useful: boolean;
  createdAt: string;
}

export interface AccountExportReport {
  id: string;
  reviewId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export interface AccountExportReputationEvent {
  id: string;
  reason: string;
  delta: number;
  createdAt: string;
}

/** Portable copy of the signed-in player's personal data (LGPD/GDPR export). */
export interface AccountExport {
  exportedAt: string;
  account: {
    email: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    reputationScore: number;
    role: UserRole;
    status: UserStatus;
    emailVerified: boolean;
    termsAcceptedAt: string | null;
    createdAt: string;
  };
  reviews: AccountExportReview[];
  votes: AccountExportVote[];
  reports: AccountExportReport[];
  reputationEvents: AccountExportReputationEvent[];
}

export interface UserProfileStats {
  totalReviews: number;
  recommendedCount: number;
  notRecommendedCount: number;
  /** Share of this user's reviews that are recommendations, 0..100. */
  recommendationPercentage: number;
  /** Total useful votes this user's reviews have received. */
  usefulVotesReceived: number;
  gamesReviewed: number;
  totalHoursPlayed: number;
}
