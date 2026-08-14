import { Injectable } from '@nestjs/common';
import { calculateGameScore } from '@gamescore/shared';
import type {
  GameStatisticsDto,
  HoursPlayedBucketDto,
  PlatformScoreDto,
  ReviewBombEventSummaryDto,
  ReviewTimelinePointDto,
} from '@gamescore/types';

import { AppConfigService } from '../../../common/config/app-config.service';
import { isoDate } from '../../../common/crypto/hash';
import { NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { toGameScoreDto, toPlatformDto } from '../../games/mappers/game.mapper';
import { GameRepository } from '../../games/repositories/game.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

const HOURS_BUCKETS: Array<{ bucket: string; min: number; max: number | null }> = [
  { bucket: '0-2', min: 0, max: 2 },
  { bucket: '2-10', min: 2, max: 10 },
  { bucket: '10-50', min: 10, max: 50 },
  { bucket: '50+', min: 50, max: null },
];

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly games: GameRepository,
    private readonly config: AppConfigService,
  ) {}

  async getBySlug(slug: string): Promise<GameStatisticsDto> {
    const game = await this.games.findBySlug(slug);
    if (!game) {
      throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
    }

    const minimum = this.config.ranking.scoreLabelMinimumReviews;
    const stats = game.statistics;
    const score = toGameScoreDto(stats, minimum);

    const hasConfirmedBombs = (stats?.totalReviews ?? 0) !== (stats?.totalReviewsExcludingBombs ?? 0);

    const scoreExcludingReviewBombs =
      hasConfirmedBombs && stats
        ? {
            ...calculateGameScore(
              {
                positive: stats.positiveReviewsExcludingBombs,
                negative: stats.negativeReviewsExcludingBombs,
              },
              minimum,
            ),
            averageRating: stats.averageRating,
            ratingCount: stats.ratingCount,
          }
        : null;

    const [platformRows, timeline, bombs, hourReviews] = await Promise.all([
      this.prisma.gameStatisticsPlatform.findMany({
        where: {
          gameId: game.id,
          totalReviews: { gte: this.config.ranking.platformMinimumReviews },
        },
        include: { platform: true },
        orderBy: { totalReviews: 'desc' },
      }),
      this.prisma.gameActivityDaily.findMany({
        where: { gameId: game.id, reviewCount: { gt: 0 } },
        orderBy: { date: 'asc' },
        take: 365,
      }),
      this.prisma.reviewBombEvent.findMany({
        where: { gameId: game.id },
        orderBy: { detectedAt: 'desc' },
      }),
      this.prisma.review.findMany({
        where: {
          gameId: game.id,
          deletedAt: null,
          status: 'PUBLISHED',
          hoursPlayed: { not: null },
        },
        select: { hoursPlayed: true, recommended: true },
      }),
    ]);

    const platforms: PlatformScoreDto[] = platformRows.map((row) => {
      const platformScore = calculateGameScore(
        { positive: row.positiveReviews, negative: row.negativeReviews },
        minimum,
      );
      return {
        platform: toPlatformDto(row.platform),
        totalReviews: row.totalReviews,
        positiveReviews: row.positiveReviews,
        negativeReviews: row.negativeReviews,
        positivePercentage: row.positivePercentage,
        confidenceScore: row.confidenceScore,
        label: platformScore.label,
      };
    });

    const timelinePoints: ReviewTimelinePointDto[] = timeline.map((day) => ({
      date: isoDate(day.date),
      positive: day.positiveCount,
      negative: day.negativeCount,
      total: day.reviewCount,
    }));

    const reviewBombEvents: ReviewBombEventSummaryDto[] = bombs.map((event) => ({
      id: event.id,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      positiveCount: event.positiveCount,
      negativeCount: event.negativeCount,
      severity: event.severity,
      status: event.status,
    }));

    const hoursPlayedDistribution: HoursPlayedBucketDto[] = HOURS_BUCKETS.map((bucket) => {
      const matching = hourReviews.filter((review) => {
        const hours = review.hoursPlayed ?? 0;
        if (hours < bucket.min) return false;
        if (bucket.max === null) return true;
        return hours < bucket.max;
      });
      return {
        bucket: bucket.bucket,
        count: matching.length,
        positive: matching.filter((review) => review.recommended).length,
        negative: matching.filter((review) => !review.recommended).length,
      };
    });

    return {
      gameId: game.id,
      slug: game.slug,
      score,
      scoreExcludingReviewBombs: scoreExcludingReviewBombs
        ? {
            totalReviews: scoreExcludingReviewBombs.totalReviews,
            positiveReviews: scoreExcludingReviewBombs.positiveReviews,
            negativeReviews: scoreExcludingReviewBombs.negativeReviews,
            positivePercentage: scoreExcludingReviewBombs.positivePercentage,
            confidenceScore: scoreExcludingReviewBombs.confidenceScore,
            label: scoreExcludingReviewBombs.label,
            averageRating: scoreExcludingReviewBombs.averageRating,
            ratingCount: scoreExcludingReviewBombs.ratingCount,
          }
        : null,
      platforms,
      timeline: timelinePoints,
      reviewBombEvents,
      hoursPlayedDistribution,
      lastCalculatedAt: stats?.lastCalculatedAt.toISOString() ?? new Date().toISOString(),
    };
  }
}
