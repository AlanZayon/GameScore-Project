import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminDashboardDto,
  AdminUserDto,
  ImportGameResultDto,
  PaginatedResponse,
  ReviewBombEventDto,
  ReviewDto,
  ReviewReportDto,
  UpdateGameRequest,
  UpdateUserRequest,
} from '@gamescore/types';
import {
  canModerateRole,
  type ReportStatus,
  type ReviewBombStatus,
  type ReviewModerationStatus,
} from '@gamescore/shared';

import { AppConfigService } from '../../../common/config/app-config.service';
import { clampLimit, clampPage, paginated } from '../../../common/http/pagination';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { JOB_NAMES } from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthUser } from '../../auth/domain/auth-user';
import { TokenService } from '../../auth/application/token.service';
import { toGameSummaryDto } from '../../games/mappers/game.mapper';
import { GameRepository } from '../../games/repositories/game.repository';
import { ReputationService } from '../../ratings/application/reputation.service';
import { ScoreRecalculationService } from '../../ratings/application/score-recalculation.service';
import { toReviewDto } from '../../reviews/mappers/review.mapper';
import { reviewListInclude, ReviewRepository } from '../../reviews/repositories/review.repository';
import { toUserSummary } from '../../users/mappers/user.mapper';
import { publicUserSelect } from '../../users/repositories/user.repository';
import { GameImportService } from '../../integrations/application/game-import.service';
import { GameSyncService } from '../../integrations/application/game-sync.service';
import { AuditService } from './audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly games: GameRepository,
    private readonly reviews: ReviewRepository,
    private readonly scores: ScoreRecalculationService,
    private readonly reputation: ReputationService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
    private readonly importer: GameImportService,
    private readonly sync: GameSyncService,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async dashboard(): Promise<AdminDashboardDto> {
    const [
      games,
      users,
      reviews,
      hiddenReviews,
      pendingReports,
      openReviewBombEvents,
      suspendedUsers,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.game.count(),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.review.count({ where: { deletedAt: null } }),
      this.prisma.review.count({ where: { status: 'HIDDEN' } }),
      this.prisma.reviewReport.count({ where: { status: 'PENDING' } }),
      this.prisma.reviewBombEvent.count({ where: { status: { in: ['DETECTED', 'CONFIRMED'] } } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
      this.audit.list(12),
    ]);

    return {
      totals: {
        games,
        users,
        reviews,
        hiddenReviews,
        pendingReports,
        openReviewBombEvents,
        suspendedUsers,
      },
      igdbConfigured: this.config.igdb.configured,
      recentAuditLogs,
    };
  }

  async listGames(page?: number, limit?: number, q?: string) {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const where = q
      ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { slug: { contains: q } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        include: {
          platforms: { include: { platform: true } },
          genres: { include: { genre: true } },
          statistics: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.game.count({ where }),
    ]);
    return paginated(
      items.map((game) => toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews)),
      total,
      safePage,
      safeLimit,
    );
  }

  async updateGame(id: string, input: UpdateGameRequest, actor: AuthUser) {
    const game = await this.games.findById(id);
    if (!game) throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game not found');

    const edited = new Set(game.editedFields);
    const assign = <K extends keyof UpdateGameRequest>(key: K, field: string) => {
      if (input[key] !== undefined) edited.add(field);
    };
    assign('name', 'name');
    assign('summary', 'summary');
    assign('description', 'description');
    assign('developer', 'developer');
    assign('publisher', 'publisher');
    assign('releaseDate', 'releaseDate');
    assign('coverImageUrl', 'coverImageUrl');
    assign('bannerImageUrl', 'bannerImageUrl');
    if (input.platformIds) edited.add('platforms');
    if (input.genreIds) edited.add('genres');

    if (input.platformIds) {
      const platforms = await this.games.findPlatformsByIds(input.platformIds);
      if (platforms.length !== input.platformIds.length) {
        throw new NotFoundError(ERROR_CODES.PLATFORM_NOT_FOUND, 'One or more platforms were not found');
      }
    }
    if (input.genreIds) {
      const genres = await this.games.findGenresByIds(input.genreIds);
      if (genres.length !== input.genreIds.length) {
        throw new NotFoundError(ERROR_CODES.GENRE_NOT_FOUND, 'One or more genres were not found');
      }
    }

    const updated = await this.games.updateEditorial(id, {
      name: input.name,
      summary: input.summary,
      description: input.description,
      developer: input.developer,
      publisher: input.publisher,
      releaseDate:
        input.releaseDate === undefined
          ? undefined
          : input.releaseDate
            ? new Date(input.releaseDate)
            : null,
      coverImageUrl: input.coverImageUrl,
      bannerImageUrl: input.bannerImageUrl,
      platformIds: input.platformIds,
      genreIds: input.genreIds,
      editedFields: [...edited],
    });

    await this.audit.record(actor.id, 'ADMIN_UPDATED_GAME', { type: 'game', id });
    return toGameSummaryDto(updated, this.config.ranking.scoreLabelMinimumReviews);
  }

  async importGame(externalId: string, actor: AuthUser): Promise<ImportGameResultDto> {
    const result = await this.importer.importByExternalId(externalId);
    await this.audit.record(actor.id, 'ADMIN_IMPORTED_GAME', { type: 'game', id: result.gameId }, {
      provider: result.provider,
      externalId: result.externalId,
      created: result.created,
    });
    return result;
  }

  async importGameByName(name: string, actor: AuthUser): Promise<ImportGameResultDto> {
    const result = await this.importer.importByName(name);
    await this.audit.record(actor.id, 'ADMIN_IMPORTED_GAME', { type: 'game', id: result.gameId }, {
      provider: result.provider,
      externalId: result.externalId,
      created: result.created,
    });
    return result;
  }

  async syncGame(id: string, actor: AuthUser): Promise<ImportGameResultDto> {
    const result = await this.sync.sync(id);
    await this.audit.record(actor.id, 'ADMIN_SYNCED_GAME', { type: 'game', id });
    return result;
  }

  async listReviews(page?: number, limit?: number, status?: string) {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const where = {
      ...(status === 'hidden' ? { status: 'HIDDEN' as const } : {}),
      ...(status === 'deleted' ? { deletedAt: { not: null } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: reviewListInclude,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(
      items.map((item) => toReviewDto(item)),
      total,
      safePage,
      safeLimit,
    );
  }

  async removeReview(id: string, actor: AuthUser, reason: string): Promise<void> {
    const review = await this.reviews.findById(id);
    if (!review || review.deletedAt) {
      throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.reviews.update(
        id,
        {
          deletedAt: new Date(),
          deletedById: actor.id,
          deletionReason: reason,
          status: 'HIDDEN',
        },
        tx,
      );
      await this.reputation.apply(
        review.userId,
        'REVIEW_REMOVED_BY_MODERATOR',
        { type: 'review', id },
        tx,
      );
      await this.scores.recalculate(review.gameId, tx);
      await this.audit.record(actor.id, 'ADMIN_DELETED_REVIEW', { type: 'review', id }, { reason }, tx);
    });
    await this.jobs.enqueue(JOB_NAMES.RECALCULATE_GAME_SCORE, { gameId: review.gameId });
    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});
    await this.reputation.invalidateUserStats(review.userId);
  }

  async restoreReview(id: string, actor: AuthUser): Promise<ReviewDto> {
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');

    const restored = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.review.findFirst({
        where: { userId: review.userId, gameId: review.gameId, deletedAt: null, id: { not: id } },
      });
      if (existing) {
        throw new ConflictError(
          ERROR_CODES.REVIEW_ALREADY_EXISTS,
          'This player already has an active review for that game',
        );
      }

      const saved = await this.reviews.update(
        id,
        {
          deletedAt: null,
          deletedById: null,
          deletionReason: null,
          status: 'PUBLISHED',
        },
        tx,
      );
      await this.scores.recalculate(review.gameId, tx);
      await this.audit.record(actor.id, 'ADMIN_RESTORED_REVIEW', { type: 'review', id }, undefined, tx);
      return saved;
    });

    await this.jobs.enqueue(JOB_NAMES.RECALCULATE_GAME_SCORE, { gameId: review.gameId });
    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});

    return toReviewDto(restored);
  }

  async updateReviewModeration(
    id: string,
    actor: AuthUser,
    moderationStatus: ReviewModerationStatus,
    notes?: string,
  ): Promise<ReviewDto> {
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');

    const updated = await this.reviews.update(id, { moderationStatus, moderationNotes: notes ?? null });
    await this.audit.record(actor.id, 'ADMIN_UPDATED_REVIEW_MODERATION', { type: 'review', id }, {
      moderationStatus,
    });
    return toReviewDto(updated);
  }

  async listReports(page?: number, limit?: number, status?: ReportStatus) {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.reviewReport.findMany({
        where,
        include: {
          reporter: { select: publicUserSelect },
          resolvedBy: { select: publicUserSelect },
          review: { include: reviewListInclude },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.reviewReport.count({ where }),
    ]);

    const mapped: ReviewReportDto[] = items.map((item) => ({
      id: item.id,
      reason: item.reason,
      details: item.details,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
      reporter: toUserSummary(item.reporter),
      resolvedBy: item.resolvedBy ? toUserSummary(item.resolvedBy) : null,
      review: toReviewDto(item.review),
    }));

    return paginated(mapped, total, safePage, safeLimit);
  }

  async resolveReport(
    id: string,
    actor: AuthUser,
    input: { status: Extract<ReportStatus, 'RESOLVED' | 'DISMISSED'>; hideReview?: boolean; reason?: string },
  ): Promise<void> {
    const report = await this.prisma.reviewReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundError(ERROR_CODES.REPORT_NOT_FOUND, 'Report not found');
    if (report.status !== 'PENDING') {
      throw new ConflictError(ERROR_CODES.REPORT_ALREADY_RESOLVED, 'Report already resolved');
    }

    let affectedUserId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.reviewReport.update({
        where: { id },
        data: {
          status: input.status,
          resolvedAt: new Date(),
          resolvedById: actor.id,
          resolutionNote: input.reason ?? null,
        },
      });

      if (input.hideReview && input.status === 'RESOLVED') {
        const review = await this.reviews.findById(report.reviewId, tx);
        if (review && !review.deletedAt) {
          affectedUserId = review.userId;
          await this.reviews.update(
            report.reviewId,
            {
              deletedAt: new Date(),
              deletedById: actor.id,
              deletionReason: input.reason ?? 'Removed after confirmed report',
              status: 'HIDDEN',
            },
            tx,
          );
          await this.reputation.apply(
            review.userId,
            'ABUSE_CONFIRMED',
            { type: 'review', id: review.id },
            tx,
          );
          await this.scores.recalculate(review.gameId, tx);
        }
      }

      await this.audit.record(
        actor.id,
        'ADMIN_RESOLVED_REPORT',
        { type: 'report', id },
        { status: input.status, hideReview: input.hideReview ?? false },
        tx,
      );
    });

    if (affectedUserId) {
      await this.reputation.invalidateUserStats(affectedUserId);
    }
  }

  async listReviewBombs(page?: number, limit?: number, status?: ReviewBombStatus) {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.reviewBombEvent.findMany({
        where,
        include: {
          game: { select: { id: true, slug: true, name: true, coverImageUrl: true } },
          reviewedBy: { select: publicUserSelect },
        },
        orderBy: [{ status: 'asc' }, { severity: 'desc' }],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.reviewBombEvent.count({ where }),
    ]);

    const mapped: ReviewBombEventDto[] = items.map((item) => ({
      id: item.id,
      game: item.game,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt.toISOString(),
      positiveCount: item.positiveCount,
      negativeCount: item.negativeCount,
      baselinePerDay: item.baselinePerDay,
      severity: item.severity,
      status: item.status,
      detectedAt: item.detectedAt.toISOString(),
      reviewedBy: item.reviewedBy ? toUserSummary(item.reviewedBy) : null,
      notes: item.notes,
    }));

    return paginated(mapped, total, safePage, safeLimit);
  }

  async updateReviewBomb(
    id: string,
    actor: AuthUser,
    status: ReviewBombStatus,
    notes?: string,
  ): Promise<void> {
    const event = await this.prisma.reviewBombEvent.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundError(ERROR_CODES.REVIEW_BOMB_EVENT_NOT_FOUND, 'Review bomb event not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reviewBombEvent.update({
        where: { id },
        data: {
          status,
          notes: notes ?? event.notes,
          reviewedAt: new Date(),
          reviewedById: actor.id,
        },
      });
      await this.scores.recalculate(event.gameId, tx);
      await this.audit.record(
        actor.id,
        'ADMIN_UPDATED_REVIEW_BOMB_EVENT',
        { type: 'review_bomb_event', id },
        { status },
        tx,
      );
    });
    await this.jobs.enqueue(JOB_NAMES.RECALCULATE_GAME_SCORE, { gameId: event.gameId });
    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});
  }

  async listUsers(page?: number, limit?: number, q?: string): Promise<PaginatedResponse<AdminUserDto>> {
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const where = q
      ? {
          deletedAt: null,
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : { deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          _count: { select: { reviews: true, reportsFiled: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(
      items.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        reputationScore: user.reputationScore,
        role: user.role,
        deleted: false,
        email: user.email,
        status: user.status,
        suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        reviewCount: user._count.reviews,
        reportCount: user._count.reportsFiled,
      })),
      total,
      safePage,
      safeLimit,
    );
  }

  async updateUser(id: string, input: UpdateUserRequest, actor: AuthUser): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }

    if (input.status === 'SUSPENDED' || (input.status === 'ACTIVE' && user.status === 'SUSPENDED')) {
      if (!canModerateRole(actor.role, user.role)) {
        throw new ForbiddenError(
          ERROR_CODES.INSUFFICIENT_ROLE,
          'You cannot suspend or reinstate an account with an equal or higher role',
        );
      }
    }

    if (input.status === 'SUSPENDED') {
      await this.prisma.user.update({
        where: { id },
        data: {
          status: 'SUSPENDED',
          suspendedUntil: input.suspendedUntil ? new Date(input.suspendedUntil) : null,
          suspensionReason: input.reason ?? 'Suspended by moderator',
        },
      });
      await this.tokens.revokeAllForUser(id);
      await this.audit.record(actor.id, 'ADMIN_SUSPENDED_USER', { type: 'user', id }, {
        reason: input.reason,
      });
    } else if (input.status === 'ACTIVE' && user.status === 'SUSPENDED') {
      await this.prisma.user.update({
        where: { id },
        data: { status: 'ACTIVE', suspendedUntil: null, suspensionReason: null },
      });
      await this.audit.record(actor.id, 'ADMIN_REINSTATED_USER', { type: 'user', id });
    }

    if (input.role && actor.role === 'ADMIN') {
      await this.prisma.user.update({ where: { id }, data: { role: input.role } });
      await this.audit.record(actor.id, 'ADMIN_UPDATED_USER_ROLE', { type: 'user', id }, {
        role: input.role,
      });
    }

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { reviews: true, reportsFiled: true } } },
    });

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      reputationScore: updated.reputationScore,
      role: updated.role,
      deleted: false,
      email: updated.email,
      status: updated.status,
      suspendedUntil: updated.suspendedUntil?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      reviewCount: updated._count.reviews,
      reportCount: updated._count.reportsFiled,
    };
  }

  async recalculateGame(id: string, actor: AuthUser): Promise<void> {
    const game = await this.games.findById(id);
    if (!game) throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
    await this.scores.recalculate(id);
    await this.audit.record(actor.id, 'ADMIN_RECALCULATED_GAME_SCORE', { type: 'game', id });
  }
}
