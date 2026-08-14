import type {
  AuditAction,
  ExternalProvider,
  ReportReason,
  ReportStatus,
  ReviewBombStatus,
  ReviewModerationStatus,
  UserRole,
  UserStatus,
} from '@gamescore/shared';

import type { ReviewDto } from './reviews';
import type { UserSummary } from './users';

export interface ImportGameRequest {
  /** External identifier, e.g. an IGDB game id. */
  externalId: string;
  provider?: ExternalProvider;
}

export interface ImportGameByNameRequest {
  name: string;
  provider?: ExternalProvider;
}

export interface ImportGameResultDto {
  gameId: string;
  slug: string;
  name: string;
  provider: ExternalProvider;
  externalId: string;
  /** False when the game already existed, proving the import is idempotent. */
  created: boolean;
  warnings: string[];
}

export interface UpdateGameRequest {
  name?: string;
  summary?: string | null;
  description?: string | null;
  developer?: string | null;
  publisher?: string | null;
  releaseDate?: string | null;
  coverImageUrl?: string | null;
  bannerImageUrl?: string | null;
  platformIds?: string[];
  genreIds?: string[];
}

export interface ModerateReviewRequest {
  reason: string;
  moderationStatus?: ReviewModerationStatus;
}

export interface UpdateUserRequest {
  role?: UserRole;
  status?: UserStatus;
  /** Required when suspending; ISO date the suspension lifts. */
  suspendedUntil?: string | null;
  reason?: string;
}

export interface ReviewReportDto {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporter: UserSummary;
  resolvedBy: UserSummary | null;
  review: ReviewDto;
}

export interface ResolveReportRequest {
  status: Extract<ReportStatus, 'RESOLVED' | 'DISMISSED'>;
  /** When true the reported review is hidden as part of resolving. */
  hideReview?: boolean;
  reason?: string;
}

export interface ReviewBombEventDto {
  id: string;
  game: {
    id: string;
    slug: string;
    name: string;
    coverImageUrl: string | null;
  };
  startAt: string;
  endAt: string;
  positiveCount: number;
  negativeCount: number;
  baselinePerDay: number;
  severity: number;
  status: ReviewBombStatus;
  detectedAt: string;
  reviewedBy: UserSummary | null;
  notes: string | null;
}

export interface UpdateReviewBombEventRequest {
  status: ReviewBombStatus;
  notes?: string;
}

export interface AdminUserDto extends UserSummary {
  email: string;
  status: UserStatus;
  suspendedUntil: string | null;
  createdAt: string;
  reviewCount: number;
  reportCount: number;
}

export interface AuditLogDto {
  id: string;
  action: AuditAction;
  actor: UserSummary | null;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminDashboardDto {
  totals: {
    games: number;
    users: number;
    reviews: number;
    hiddenReviews: number;
    pendingReports: number;
    openReviewBombEvents: number;
    suspendedUsers: number;
  };
  igdbConfigured: boolean;
  recentAuditLogs: AuditLogDto[];
}
