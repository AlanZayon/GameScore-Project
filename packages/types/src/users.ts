import type { UserRole, UserStatus } from '@gamescore/shared';

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
