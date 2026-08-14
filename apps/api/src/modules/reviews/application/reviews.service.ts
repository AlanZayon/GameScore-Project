import { Inject, Injectable } from '@nestjs/common';
import type { ReviewRecommendationFilter, ReviewSort } from '@gamescore/shared';
import type {
  CreateReviewRequest,
  CursorPaginatedResponse,
  ReviewDto,
  ReviewVoteResponse,
  UpdateReviewRequest,
} from '@gamescore/types';
import type { ReportReason } from '@gamescore/shared';

import { AppConfigService } from '../../../common/config/app-config.service';
import { hashClientIp, isoDate, reviewFingerprint } from '../../../common/crypto/hash';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { clampLimit, cursorMeta, DEFAULT_CURSOR_SIZE } from '../../../common/http/pagination';
import { JOB_NAMES } from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthUser } from '../../auth/domain/auth-user';
import { GameRepository } from '../../games/repositories/game.repository';
import { ReputationService } from '../../ratings/application/reputation.service';
import { ReviewRankingService } from '../../ratings/application/review-ranking.service';
import { ScoreRecalculationService } from '../../ratings/application/score-recalculation.service';
import { toReviewDto } from '../mappers/review.mapper';
import { ReviewRepository, type ReviewWithRelations } from '../repositories/review.repository';
import { AntiSpamService } from './anti-spam.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly games: GameRepository,
    private readonly antiSpam: AntiSpamService,
    private readonly ranking: ReviewRankingService,
    private readonly reputation: ReputationService,
    private readonly scores: ScoreRecalculationService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async listForGame(
    slug: string,
    query: {
      sort?: ReviewSort;
      recommendation?: ReviewRecommendationFilter;
      platformId?: string;
      minHoursPlayed?: number;
      maxHoursPlayed?: number;
      cursor?: string;
      limit?: number;
    },
    viewer?: AuthUser | null,
  ): Promise<CursorPaginatedResponse<ReviewDto>> {
    const game = await this.requireGame(slug);
    const limit = clampLimit(query.limit, DEFAULT_CURSOR_SIZE);
    const { items, nextCursor } = await this.reviews.list({
      gameId: game.id,
      sort: query.sort ?? 'BEST',
      recommendation: query.recommendation ?? 'ALL',
      platformId: query.platformId,
      minHoursPlayed: query.minHoursPlayed,
      maxHoursPlayed: query.maxHoursPlayed,
      viewerId: viewer?.id,
      cursor: query.cursor,
      limit,
    });

    return {
      items: await this.withViewerContext(items, viewer?.id),
      meta: cursorMeta(limit, nextCursor),
    };
  }

  async getById(id: string, viewer?: AuthUser | null): Promise<ReviewDto> {
    const review = await this.requireReview(id);
    const [mapped] = await this.withViewerContext([review], viewer?.id);
    return mapped!;
  }

  async create(
    slug: string,
    input: CreateReviewRequest,
    author: AuthUser,
    clientIp?: string,
  ): Promise<ReviewDto> {
    const game = await this.requireGame(slug);
    const existing = await this.reviews.findActiveByUserAndGame(author.id, game.id);
    if (existing) {
      throw new ConflictError(
        ERROR_CODES.REVIEW_ALREADY_EXISTS,
        'You already have a review for this game',
      );
    }

    await this.assertPlatform(game.id, input.platformId);
    this.assertReviewPayload(input);

    const fingerprint = reviewFingerprint(input.text);
    const ipHash = hashClientIp(clientIp, this.config.jwt.accessSecret);
    const spam = await this.antiSpam.inspect({
      userId: author.id,
      text: input.text,
      fingerprint,
      ipHash,
    });

    const rankingScore = this.ranking.score({
      usefulVotes: 0,
      notUsefulVotes: 0,
      authorReputation: author.reputationScore,
      textLength: input.text.trim().length,
      hoursPlayed: input.hoursPlayed,
      rating: input.rating,
      createdAt: new Date(),
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const review = await this.reviews.create(
        {
          gameId: game.id,
          userId: author.id,
          recommended: input.recommended,
          text: input.text.trim(),
          rating: input.rating ?? null,
          hoursPlayed: input.hoursPlayed ?? null,
          platformId: input.platformId ?? null,
          rankingScore,
          textFingerprint: fingerprint,
          authorIpHash: ipHash,
          moderationStatus: spam.moderationStatus,
        },
        tx,
      );

      await this.reputation.apply(
        author.id,
        'REVIEW_PUBLISHED',
        { type: 'review', id: review.id },
        tx,
      );
      await this.scores.bumpDailyActivity(game.id, input.recommended, review.createdAt, 1, tx);
      await this.scores.recalculate(game.id, tx);
      return review;
    });

    await this.jobs.enqueue(JOB_NAMES.DETECT_REVIEW_BOMB, {
      gameId: game.id,
      date: isoDate(created.createdAt),
    });
    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});

    const [mapped] = await this.withViewerContext([created], author.id);
    return mapped!;
  }

  async update(id: string, input: UpdateReviewRequest, actor: AuthUser): Promise<ReviewDto> {
    const review = await this.requireReview(id);
    if (review.userId !== actor.id) {
      throw new ForbiddenError(ERROR_CODES.REVIEW_NOT_OWNED, 'You can only edit your own review');
    }
    if (review.deletedAt) {
      throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');
    }

    this.assertReviewPayload({
      recommended: input.recommended ?? review.recommended,
      text: input.text ?? review.text,
      rating: input.rating === undefined ? review.rating : input.rating,
      hoursPlayed: input.hoursPlayed === undefined ? review.hoursPlayed : input.hoursPlayed,
    });

    if (input.platformId !== undefined) {
      await this.assertPlatform(review.gameId, input.platformId);
    }

    const nextText = input.text?.trim() ?? review.text;
    const fingerprint = reviewFingerprint(nextText);
    const rankingScore = this.ranking.score({
      usefulVotes: review.usefulCount,
      notUsefulVotes: review.notUsefulCount,
      authorReputation: actor.reputationScore,
      textLength: nextText.length,
      hoursPlayed: input.hoursPlayed === undefined ? review.hoursPlayed : input.hoursPlayed,
      rating: input.rating === undefined ? review.rating : input.rating,
      createdAt: review.createdAt,
    });

    const previousRecommended = review.recommended;
    const nextRecommended = input.recommended ?? review.recommended;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await this.reviews.update(
        id,
        {
          recommended: nextRecommended,
          text: nextText,
          rating: input.rating === undefined ? undefined : input.rating,
          hoursPlayed: input.hoursPlayed === undefined ? undefined : input.hoursPlayed,
          platformId: input.platformId === undefined ? undefined : input.platformId,
          edited: true,
          textFingerprint: fingerprint,
          rankingScore,
        },
        tx,
      );

      if (previousRecommended !== nextRecommended) {
        await this.scores.bumpDailyActivity(review.gameId, previousRecommended, review.createdAt, -1, tx);
        await this.scores.bumpDailyActivity(review.gameId, nextRecommended, review.createdAt, 1, tx);
      }

      await this.scores.recalculate(review.gameId, tx);
      return saved;
    });

    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});
    const [mapped] = await this.withViewerContext([updated], actor.id);
    return mapped!;
  }

  async softDelete(id: string, actor: AuthUser, reason?: string): Promise<void> {
    const review = await this.requireReview(id);
    const isOwner = review.userId === actor.id;
    const isStaff = actor.role === 'MODERATOR' || actor.role === 'ADMIN';
    if (!isOwner && !isStaff) {
      throw new ForbiddenError(ERROR_CODES.REVIEW_NOT_OWNED, 'You can only delete your own review');
    }
    if (review.deletedAt) {
      throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.reviews.update(
        id,
        {
          deletedAt: new Date(),
          deletedById: actor.id,
          deletionReason: reason ?? (isOwner ? 'Deleted by author' : 'Removed by moderator'),
          status: 'HIDDEN',
        },
        tx,
      );

      await this.reputation.apply(
        review.userId,
        isOwner ? 'REVIEW_DELETED' : 'REVIEW_REMOVED_BY_MODERATOR',
        { type: 'review', id: review.id },
        tx,
      );
      await this.scores.bumpDailyActivity(review.gameId, review.recommended, review.createdAt, -1, tx);
      await this.scores.recalculate(review.gameId, tx);
    });

    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});
  }

  async vote(id: string, useful: boolean, voter: AuthUser): Promise<ReviewVoteResponse> {
    const review = await this.requireReview(id);
    if (review.userId === voter.id) {
      throw new ForbiddenError(ERROR_CODES.CANNOT_VOTE_OWN_REVIEW, 'You cannot vote on your own review');
    }
    if (review.deletedAt || review.status !== 'PUBLISHED') {
      throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await this.reviews.findVote(id, voter.id, tx);

      if (existing?.useful === useful) {
        return this.reviews.findById(id, tx);
      }

      if (existing) {
        await this.reviews.upsertVote(id, voter.id, useful, tx);
        await this.reputation.apply(
          review.userId,
          existing.useful ? 'USEFUL_VOTE_REMOVED' : 'NOT_USEFUL_VOTE_REMOVED',
          { type: 'review', id },
          tx,
        );
        await this.reputation.apply(
          review.userId,
          useful ? 'USEFUL_VOTE_RECEIVED' : 'NOT_USEFUL_VOTE_RECEIVED',
          { type: 'review', id },
          tx,
        );
        await this.reviews.update(
          id,
          {
            usefulCount: { increment: useful ? 1 : -1 },
            notUsefulCount: { increment: useful ? -1 : 1 },
          },
          tx,
        );
      } else {
        await this.reviews.upsertVote(id, voter.id, useful, tx);
        await this.reputation.apply(
          review.userId,
          useful ? 'USEFUL_VOTE_RECEIVED' : 'NOT_USEFUL_VOTE_RECEIVED',
          { type: 'review', id },
          tx,
        );
        await this.reviews.update(
          id,
          useful ? { usefulCount: { increment: 1 } } : { notUsefulCount: { increment: 1 } },
          tx,
        );
      }

      const updated = await this.reviews.findById(id, tx);
      if (updated) {
        const rankingScore = this.ranking.score({
          usefulVotes: updated.usefulCount,
          notUsefulVotes: updated.notUsefulCount,
          authorReputation: updated.user.reputationScore,
          textLength: updated.text.length,
          hoursPlayed: updated.hoursPlayed,
          rating: updated.rating,
          createdAt: updated.createdAt,
        });
        await this.ranking.persist(id, rankingScore, tx);
        return this.reviews.findById(id, tx);
      }
      return updated;
    });

    if (!result) {
      throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');
    }

    return {
      reviewId: result.id,
      usefulCount: result.usefulCount,
      notUsefulCount: result.notUsefulCount,
      viewerVote: useful ? 'USEFUL' : 'NOT_USEFUL',
    };
  }

  async removeVote(id: string, voter: AuthUser): Promise<ReviewVoteResponse> {
    const review = await this.requireReview(id);
    const existing = await this.reviews.findVote(id, voter.id);
    if (!existing) {
      throw new NotFoundError(ERROR_CODES.VOTE_NOT_FOUND, 'You have not voted on this review');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.reviews.deleteVote(id, voter.id, tx);
      await this.reputation.apply(
        review.userId,
        existing.useful ? 'USEFUL_VOTE_REMOVED' : 'NOT_USEFUL_VOTE_REMOVED',
        { type: 'review', id },
        tx,
      );
      await this.reviews.update(
        id,
        existing.useful
          ? { usefulCount: { decrement: 1 } }
          : { notUsefulCount: { decrement: 1 } },
        tx,
      );
      return this.reviews.findById(id, tx);
    });

    return {
      reviewId: id,
      usefulCount: result?.usefulCount ?? 0,
      notUsefulCount: result?.notUsefulCount ?? 0,
      viewerVote: null,
    };
  }

  async report(
    id: string,
    input: { reason: ReportReason; details?: string },
    reporter: AuthUser,
  ): Promise<void> {
    const review = await this.requireReview(id);
    if (review.userId === reporter.id) {
      throw new ForbiddenError(
        ERROR_CODES.CANNOT_REPORT_OWN_REVIEW,
        'You cannot report your own review',
      );
    }

    const existing = await this.reviews.findReport(id, reporter.id);
    if (existing) {
      throw new ConflictError(ERROR_CODES.REVIEW_ALREADY_REPORTED, 'You have already reported this review');
    }

    await this.reviews.createReport({
      reviewId: id,
      reporterId: reporter.id,
      reason: input.reason,
      details: input.details,
    });
  }

  private async withViewerContext(
    items: ReviewWithRelations[],
    viewerId?: string,
  ): Promise<ReviewDto[]> {
    const context = viewerId
      ? await this.reviews.viewerContext(
          items.map((item) => item.id),
          viewerId,
        )
      : { votes: new Map<string, boolean>(), reports: new Set<string>() };

    return items.map((item) =>
      toReviewDto(item, {
        viewerId,
        viewerVote: context.votes.has(item.id) ? context.votes.get(item.id)! : null,
        viewerHasReported: context.reports.has(item.id),
      }),
    );
  }

  private async requireGame(slug: string) {
    const game = await this.games.findBySlug(slug);
    if (!game) {
      throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
    }
    return game;
  }

  private async requireReview(id: string) {
    const review = await this.reviews.findById(id);
    if (!review) {
      throw new NotFoundError(ERROR_CODES.REVIEW_NOT_FOUND, 'Review not found');
    }
    return review;
  }

  private async assertPlatform(gameId: string, platformId?: string | null): Promise<void> {
    if (!platformId) return;
    const game = await this.games.findById(gameId);
    const allowed = game?.platforms.some((link) => link.platformId === platformId);
    if (!allowed) {
      throw new BadRequestError(
        ERROR_CODES.PLATFORM_NOT_AVAILABLE_FOR_GAME,
        'That platform is not listed for this game',
      );
    }
  }

  private assertReviewPayload(input: {
    recommended: boolean;
    text: string;
    rating?: number | null;
    hoursPlayed?: number | null;
  }): void {
    if (input.rating != null && (input.rating < 0 || input.rating > 10)) {
      throw new BadRequestError(ERROR_CODES.VALIDATION_FAILED, 'Rating must be between 0 and 10');
    }
    if (input.hoursPlayed != null && (input.hoursPlayed < 0 || input.hoursPlayed > 100_000)) {
      throw new BadRequestError(ERROR_CODES.VALIDATION_FAILED, 'Hours played is out of range');
    }
    if (!input.text || input.text.trim().length === 0) {
      throw new BadRequestError(ERROR_CODES.VALIDATION_FAILED, 'Review text is required');
    }
  }
}
