import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { calculateGameScore } from '@gamescore/shared';

import { AppConfigService } from '../../../common/config/app-config.service';
import { utcDate } from '../../../common/crypto/hash';
import {
  JOB_NAMES,
  type RecalculateGameScorePayload,
} from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService, type PrismaTransaction } from '../../../common/prisma/prisma.service';

const RANKINGS_CACHE_PREFIX = 'rankings:';
const HOME_CACHE_KEY = 'home:feed';

interface ReviewAggregate {
  total: number;
  positive: number;
  negative: number;
  ratingSum: number;
  ratingCount: number;
  hoursSum: number;
}

/**
 * Rebuilds derived game statistics from reviews. Reviews remain the source of
 * truth; this service is the only writer of GameStatistics rows.
 */
@Injectable()
export class ScoreRecalculationService implements OnModuleInit {
  private readonly logger = new Logger(ScoreRecalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly cache: CacheService,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<RecalculateGameScorePayload>(JOB_NAMES.RECALCULATE_GAME_SCORE, (payload) =>
      this.recalculate(payload.gameId),
    );
    this.jobs.register(JOB_NAMES.INVALIDATE_RANKINGS, async () => {
      await this.cache.deleteByPrefix(RANKINGS_CACHE_PREFIX);
      await this.cache.delete(HOME_CACHE_KEY);
    });
  }

  async recalculate(gameId: string, tx?: PrismaTransaction): Promise<void> {
    if (tx) {
      await this.recalculateInside(gameId, tx);
      return;
    }

    await this.prisma.$transaction((inner) => this.recalculateInside(gameId, inner));
    await this.jobs.enqueue(JOB_NAMES.INVALIDATE_RANKINGS, {});
  }

  private async recalculateInside(gameId: string, tx: PrismaTransaction): Promise<void> {
    const visibleWhere = {
      gameId,
      deletedAt: null,
      status: 'PUBLISHED' as const,
    };

    const [counts, ratingAgg, hoursAgg, bombWindows, platformRows] = await Promise.all([
      tx.review.groupBy({
        by: ['recommended'],
        where: visibleWhere,
        _count: { _all: true },
      }),
      tx.review.aggregate({
        where: { ...visibleWhere, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      tx.review.aggregate({
        where: { ...visibleWhere, hoursPlayed: { not: null } },
        _sum: { hoursPlayed: true },
      }),
      tx.reviewBombEvent.findMany({
        where: { gameId, status: 'CONFIRMED' },
        select: { startAt: true, endAt: true },
      }),
      tx.review.groupBy({
        by: ['platformId', 'recommended'],
        where: { ...visibleWhere, platformId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const overall = this.fromGrouped(counts);
    const score = calculateGameScore(
      { positive: overall.positive, negative: overall.negative },
      this.config.ranking.scoreLabelMinimumReviews,
    );

    let excludingScore = score;

    if (bombWindows.length > 0) {
      const excluded = await tx.review.findMany({
        where: {
          ...visibleWhere,
          OR: bombWindows.map((window) => ({
            createdAt: { gte: window.startAt, lte: window.endAt },
          })),
        },
        select: { recommended: true },
      });

      const excludedPositive = excluded.filter((row) => row.recommended).length;
      const excludedNegative = excluded.length - excludedPositive;
      const excluding = {
        total: Math.max(0, overall.total - excluded.length),
        positive: Math.max(0, overall.positive - excludedPositive),
        negative: Math.max(0, overall.negative - excludedNegative),
        ratingSum: 0,
        ratingCount: 0,
        hoursSum: 0,
      };
      excludingScore = calculateGameScore(
        { positive: excluding.positive, negative: excluding.negative },
        this.config.ranking.scoreLabelMinimumReviews,
      );
    }

    await tx.gameStatistics.upsert({
      where: { gameId },
      create: {
        gameId,
        totalReviews: score.totalReviews,
        positiveReviews: score.positiveReviews,
        negativeReviews: score.negativeReviews,
        positivePercentage: score.positivePercentage,
        wilsonLowerBound: score.wilsonLowerBound,
        confidenceScore: score.confidenceScore,
        averageRating: ratingAgg._avg.rating,
        ratingCount: ratingAgg._count.rating,
        totalHoursPlayed: hoursAgg._sum.hoursPlayed ?? 0,
        totalReviewsExcludingBombs: excludingScore.totalReviews,
        positiveReviewsExcludingBombs: excludingScore.positiveReviews,
        negativeReviewsExcludingBombs: excludingScore.negativeReviews,
        positivePercentageExcludingBombs: excludingScore.positivePercentage,
        confidenceScoreExcludingBombs: excludingScore.confidenceScore,
        lastCalculatedAt: new Date(),
      },
      update: {
        totalReviews: score.totalReviews,
        positiveReviews: score.positiveReviews,
        negativeReviews: score.negativeReviews,
        positivePercentage: score.positivePercentage,
        wilsonLowerBound: score.wilsonLowerBound,
        confidenceScore: score.confidenceScore,
        averageRating: ratingAgg._avg.rating,
        ratingCount: ratingAgg._count.rating,
        totalHoursPlayed: hoursAgg._sum.hoursPlayed ?? 0,
        totalReviewsExcludingBombs: excludingScore.totalReviews,
        positiveReviewsExcludingBombs: excludingScore.positiveReviews,
        negativeReviewsExcludingBombs: excludingScore.negativeReviews,
        positivePercentageExcludingBombs: excludingScore.positivePercentage,
        confidenceScoreExcludingBombs: excludingScore.confidenceScore,
        lastCalculatedAt: new Date(),
      },
    });

    await tx.gameStatisticsPlatform.deleteMany({ where: { gameId } });

    const perPlatform = new Map<string, { positive: number; negative: number }>();
    for (const row of platformRows) {
      if (!row.platformId) continue;
      const current = perPlatform.get(row.platformId) ?? { positive: 0, negative: 0 };
      if (row.recommended) current.positive += row._count._all;
      else current.negative += row._count._all;
      perPlatform.set(row.platformId, current);
    }

    if (perPlatform.size > 0) {
      await tx.gameStatisticsPlatform.createMany({
        data: [...perPlatform.entries()].map(([platformId, countsForPlatform]) => {
          const platformScore = calculateGameScore(countsForPlatform);
          return {
            gameId,
            platformId,
            totalReviews: platformScore.totalReviews,
            positiveReviews: platformScore.positiveReviews,
            negativeReviews: platformScore.negativeReviews,
            positivePercentage: platformScore.positivePercentage,
            confidenceScore: platformScore.confidenceScore,
            lastCalculatedAt: new Date(),
          };
        }),
      });
    }

    this.logger.debug(`Recalculated statistics for game ${gameId} (${score.totalReviews} reviews)`);
  }

  async bumpDailyActivity(
    gameId: string,
    recommended: boolean,
    createdAt: Date,
    delta: 1 | -1,
    tx: PrismaTransaction,
  ): Promise<void> {
    const date = utcDate(createdAt);
    const existing = await tx.gameActivityDaily.findUnique({
      where: { gameId_date: { gameId, date } },
    });

    if (!existing) {
      if (delta < 0) return;
      await tx.gameActivityDaily.create({
        data: {
          gameId,
          date,
          reviewCount: 1,
          positiveCount: recommended ? 1 : 0,
          negativeCount: recommended ? 0 : 1,
        },
      });
      return;
    }

    const reviewCount = Math.max(0, existing.reviewCount + delta);
    const positiveCount = Math.max(0, existing.positiveCount + (recommended ? delta : 0));
    const negativeCount = Math.max(0, existing.negativeCount + (recommended ? 0 : delta));

    await tx.gameActivityDaily.update({
      where: { gameId_date: { gameId, date } },
      data: { reviewCount, positiveCount, negativeCount },
    });
  }

  private fromGrouped(
    groups: Array<{ recommended: boolean; _count: { _all: number } }>,
  ): ReviewAggregate {
    let positive = 0;
    let negative = 0;
    for (const group of groups) {
      if (group.recommended) positive += group._count._all;
      else negative += group._count._all;
    }
    return {
      total: positive + negative,
      positive,
      negative,
      ratingSum: 0,
      ratingCount: 0,
      hoursSum: 0,
    };
  }
}
