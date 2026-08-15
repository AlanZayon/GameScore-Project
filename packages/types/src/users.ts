import type { UserRole, UserStatus } from '@gamescore/shared';

/** Minimal user representation, safe to embed anywhere (never includes email). */
export interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  role: UserRole;
}

/** The authenticated user's own account. Includes private fields. */
export interface AuthenticatedUser extends UserSummary {
  email: string;
  status: UserStatus;
  createdAt: string;
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
