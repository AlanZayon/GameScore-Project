import type {
  ReportReason,
  ReviewModerationStatus,
  ReviewRecommendationFilter,
  ReviewSort,
  ReviewStatus,
} from '@gamescore/shared';

import type { PlatformDto } from './games';
import type { UserSummary } from './users';

export interface ReviewGameRefDto {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
}

export interface ReviewDto {
  id: string;
  author: UserSummary;
  game: ReviewGameRefDto;
  recommended: boolean;
  /** Optional 0-10 rating; it complements the recommendation, never replaces it. */
  rating: number | null;
  text: string;
  hoursPlayed: number | null;
  platform: PlatformDto | null;
  usefulCount: number;
  notUsefulCount: number;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  status: ReviewStatus;
  moderationStatus: ReviewModerationStatus;
  /** How the caller voted on this review, when authenticated. */
  viewerVote: 'USEFUL' | 'NOT_USEFUL' | null;
  /** True when the caller wrote this review. */
  viewerIsAuthor: boolean;
  /** True when the caller already reported this review. */
  viewerHasReported: boolean;
}

export interface CreateReviewRequest {
  recommended: boolean;
  text: string;
  rating?: number | null;
  hoursPlayed?: number | null;
  platformId?: string | null;
}

export type UpdateReviewRequest = Partial<CreateReviewRequest>;

export interface VoteReviewRequest {
  useful: boolean;
}

export interface ReviewVoteResponse {
  reviewId: string;
  usefulCount: number;
  notUsefulCount: number;
  viewerVote: 'USEFUL' | 'NOT_USEFUL' | null;
}

export interface ReportReviewRequest {
  reason: ReportReason;
  details?: string;
}

export interface ReviewListQuery {
  sort?: ReviewSort;
  recommendation?: ReviewRecommendationFilter;
  platformId?: string;
  minHoursPlayed?: number;
  maxHoursPlayed?: number;
  cursor?: string;
  limit?: number;
}
