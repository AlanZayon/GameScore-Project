import { Injectable } from '@nestjs/common';
import { roleRank, type ReputationReason } from '@gamescore/shared';
import type {
  CursorPaginatedResponse,
  ReputationEventDto,
  UserStatisticsDto,
  UserStatisticsRange,
} from '@gamescore/types';

import { CacheService } from '../../../common/cache/cache.service';
import { NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import {
  clampLimit,
  cursorMeta,
  decodeCursor,
  DEFAULT_CURSOR_SIZE,
  encodeCursor,
} from '../../../common/http/pagination';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthUser } from '../../auth/domain/auth-user';
import { UserRepository } from '../repositories/user.repository';
import {
  aggregateCategoryBuckets,
  aggregateHoursBuckets,
  buildActivity,
  buildReputationSummary,
  buildTimeline,
  buildTopUsefulReviews,
  inRange,
  recommendationPercentage,
  rangeStart,
  USER_ANALYTICS_MIN_REVIEWS,
  USER_STATS_CACHE_PREFIX,
  USER_STATS_CACHE_TTL_SECONDS,
  userStatsCacheKey,
  type ReviewAggInput,
} from '../domain/user-statistics';

const PUBLISHED_WHERE = { deletedAt: null, status: 'PUBLISHED' as const };

@Injectable()
export class UserStatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserRepository,
    private readonly cache: CacheService,
  ) {}

  async getStatistics(
    username: string,
    range: UserStatisticsRange = 'all',
    viewer?: AuthUser | null,
  ): Promise<UserStatisticsDto> {
    const user = await this.users.findProfileByUsername(username);
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }

    const includeSensitive = isStaff(viewer);
    const cacheKey = `${userStatsCacheKey(user.id, range)}:${includeSensitive ? 'staff' : 'public'}`;

    return this.cache.wrap(cacheKey, USER_STATS_CACHE_TTL_SECONDS, () =>
      this.computeStatistics(user.id, user.username, user.reputationScore, range, includeSensitive),
    );
  }

  async listReputationEvents(
    username: string,
    cursor: string | undefined,
    limit: number | undefined,
    viewer?: AuthUser | null,
  ): Promise<CursorPaginatedResponse<ReputationEventDto>> {
    const user = await this.users.findProfileByUsername(username);
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }

    const pageSize = clampLimit(limit, DEFAULT_CURSOR_SIZE);
    const includeSensitive = isStaff(viewer);
    const cursorPayload = cursor
      ? decodeCursor<{ createdAt: string; id: string }>(cursor)
      : null;

    const events = await this.prisma.reputationEvent.findMany({
      where: {
        userId: user.id,
        ...(includeSensitive
          ? {}
          : {
              reason: {
                notIn: ['REVIEW_REMOVED_BY_MODERATOR', 'ABUSE_CONFIRMED'],
              },
            }),
        ...(cursorPayload
          ? {
              OR: [
                { createdAt: { lt: new Date(cursorPayload.createdAt) } },
                {
                  createdAt: new Date(cursorPayload.createdAt),
                  id: { lt: cursorPayload.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const page = events.slice(0, pageSize);
    const last = page[page.length - 1];
    const nextCursor =
      events.length > pageSize && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return {
      items: page.map((event) => ({
        id: event.id,
        reason: event.reason as ReputationReason,
        delta: event.delta,
        balanceAfter: event.balanceAfter,
        createdAt: event.createdAt.toISOString(),
      })),
      meta: cursorMeta(pageSize, nextCursor),
    };
  }

  async invalidateForUser(userId: string): Promise<void> {
    await this.cache.deleteByPrefix(`${USER_STATS_CACHE_PREFIX}${userId}`);
  }

  private async computeStatistics(
    userId: string,
    username: string,
    reputationScore: number,
    range: UserStatisticsRange,
    includeSensitive: boolean,
  ): Promise<UserStatisticsDto> {
    const start = rangeStart(range);

    const [reviewsRaw, eventsRaw, siteAgg, allTimeCount, distinctGames] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId, ...PUBLISHED_WHERE },
        select: {
          id: true,
          gameId: true,
          recommended: true,
          usefulCount: true,
          notUsefulCount: true,
          hoursPlayed: true,
          platformId: true,
          createdAt: true,
          text: true,
          platform: { select: { slug: true, name: true } },
          game: {
            select: {
              slug: true,
              name: true,
              coverImageUrl: true,
              genres: { select: { genre: { select: { slug: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reputationEvent.findMany({
        where: { userId },
        select: { reason: true, delta: true, balanceAfter: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.review.groupBy({
        by: ['recommended'],
        where: PUBLISHED_WHERE,
        _count: { _all: true },
      }),
      this.prisma.review.count({ where: { userId, ...PUBLISHED_WHERE } }),
      this.prisma.review.findMany({
        where: { userId, ...PUBLISHED_WHERE },
        distinct: ['gameId'],
        select: { gameId: true },
      }),
    ]);

    const reviews: ReviewAggInput[] = reviewsRaw.map((review) => ({
      id: review.id,
      gameId: review.gameId,
      recommended: review.recommended,
      usefulCount: review.usefulCount,
      notUsefulCount: review.notUsefulCount,
      hoursPlayed: review.hoursPlayed,
      platformId: review.platformId,
      platformSlug: review.platform?.slug ?? null,
      platformName: review.platform?.name ?? null,
      createdAt: review.createdAt,
      text: review.text,
      gameSlug: review.game.slug,
      gameName: review.game.name,
      gameCoverImageUrl: review.game.coverImageUrl,
      genres: review.game.genres.map((row) => row.genre),
    }));

    const rangedReviews = reviews.filter((review) => inRange(review.createdAt, start));
    const rangedEvents = eventsRaw.filter((event) => inRange(event.createdAt, start));

    let siteRecommended = 0;
    let siteTotal = 0;
    for (const row of siteAgg) {
      siteTotal += row._count._all;
      if (row.recommended) siteRecommended += row._count._all;
    }

    const recommendedCount = rangedReviews.filter((review) => review.recommended).length;
    const notRecommendedCount = rangedReviews.length - recommendedCount;

    const usefulVotes = rangedReviews.reduce((sum, review) => sum + review.usefulCount, 0);
    const notUsefulVotes = rangedReviews.reduce((sum, review) => sum + review.notUsefulCount, 0);
    const voteTotal = usefulVotes + notUsefulVotes;

    const hoursReviews = rangedReviews.filter((review) => review.hoursPlayed !== null);
    const totalHoursPlayed = hoursReviews.reduce(
      (sum, review) => sum + (review.hoursPlayed ?? 0),
      0,
    );

    const analyticsAvailable = allTimeCount >= USER_ANALYTICS_MIN_REVIEWS;

    return {
      username,
      range,
      sampleSize: rangedReviews.length,
      analyticsAvailable,
      recommendedCount,
      notRecommendedCount,
      recommendationPercentage: recommendationPercentage(recommendedCount, rangedReviews.length),
      siteRecommendationPercentage: recommendationPercentage(siteRecommended, siteTotal),
      usefulRate:
        voteTotal === 0 ? null : Math.round((usefulVotes / voteTotal) * 10000) / 100,
      totalHoursPlayed,
      averageHoursPlayed:
        hoursReviews.length === 0
          ? null
          : Math.round((totalHoursPlayed / hoursReviews.length) * 100) / 100,
      gamesReviewed: distinctGames.length,
      byGenre: analyticsAvailable ? aggregateCategoryBuckets(rangedReviews, 'genre') : [],
      byPlatform: analyticsAvailable ? aggregateCategoryBuckets(rangedReviews, 'platform') : [],
      timeline: analyticsAvailable ? buildTimeline(rangedReviews, rangedEvents, range) : [],
      hoursPlayedDistribution: analyticsAvailable ? aggregateHoursBuckets(rangedReviews) : [],
      reputation: buildReputationSummary(reputationScore, eventsRaw, includeSensitive),
      topUsefulReviews: analyticsAvailable ? buildTopUsefulReviews(rangedReviews) : [],
      activity: analyticsAvailable
        ? buildActivity(rangedReviews)
        : { activeMonths: 0, reviewsPerMonth: 0 },
    };
  }
}

function isStaff(viewer?: AuthUser | null): boolean {
  if (!viewer) return false;
  return roleRank(viewer.role) >= roleRank('MODERATOR');
}
