import {
  isSensitiveReputationReason,
  reputationRankingWeightRatio,
  reputationTier,
  type ReputationReason,
} from '@gamescore/shared';
import type {
  UserActivityDto,
  UserCategoryBreakdownDto,
  UserHoursBucketDto,
  UserReputationBreakdownDto,
  UserReputationSummaryDto,
  UserStatisticsRange,
  UserTimelinePointDto,
  UserTopReviewDto,
} from '@gamescore/types';

export const USER_ANALYTICS_MIN_REVIEWS = 3;
export const USER_CATEGORY_MIN_REVIEWS = 3;
export const USER_STATS_CACHE_TTL_SECONDS = 120;
export const USER_STATS_CACHE_PREFIX = 'user:stats:';

export const HOURS_BUCKETS: Array<{ bucket: string; min: number; max: number | null }> = [
  { bucket: '0-2', min: 0, max: 2 },
  { bucket: '2-10', min: 2, max: 10 },
  { bucket: '10-50', min: 10, max: 50 },
  { bucket: '50+', min: 50, max: null },
];

export const UNSPECIFIED_PLATFORM_KEY = 'unspecified';

export interface ReviewAggInput {
  id: string;
  gameId: string;
  recommended: boolean;
  usefulCount: number;
  notUsefulCount: number;
  hoursPlayed: number | null;
  platformId: string | null;
  platformSlug: string | null;
  platformName: string | null;
  createdAt: Date;
  text: string;
  gameSlug: string;
  gameName: string;
  gameCoverImageUrl: string | null;
  genres: Array<{ slug: string; name: string }>;
}

export interface ReputationEventAggInput {
  reason: string;
  delta: number;
  balanceAfter: number;
  createdAt: Date;
}

export function rangeStart(range: UserStatisticsRange, now = new Date()): Date | null {
  if (range === 'all') return null;
  const start = new Date(now);
  if (range === '3m') {
    start.setUTCMonth(start.getUTCMonth() - 3);
  } else {
    start.setUTCMonth(start.getUTCMonth() - 12);
  }
  return start;
}

export function inRange(date: Date, start: Date | null): boolean {
  if (!start) return true;
  return date >= start;
}

export function recommendationPercentage(recommended: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((recommended / total) * 10000) / 100;
}

export function aggregateCategoryBuckets(
  reviews: ReviewAggInput[],
  mode: 'genre' | 'platform',
  minCount = USER_CATEGORY_MIN_REVIEWS,
): UserCategoryBreakdownDto[] {
  const map = new Map<string, { name: string; reviewCount: number; recommendedCount: number }>();

  for (const review of reviews) {
    if (mode === 'genre') {
      if (review.genres.length === 0) continue;
      for (const genre of review.genres) {
        const current = map.get(genre.slug) ?? {
          name: genre.name,
          reviewCount: 0,
          recommendedCount: 0,
        };
        current.reviewCount += 1;
        if (review.recommended) current.recommendedCount += 1;
        map.set(genre.slug, current);
      }
      continue;
    }

    const key = review.platformSlug ?? UNSPECIFIED_PLATFORM_KEY;
    const name = review.platformName ?? 'Unspecified';
    const current = map.get(key) ?? { name, reviewCount: 0, recommendedCount: 0 };
    current.reviewCount += 1;
    if (review.recommended) current.recommendedCount += 1;
    map.set(key, current);
  }

  return [...map.entries()]
    .filter(([, value]) => value.reviewCount >= minCount)
    .map(([key, value]) => ({
      key,
      name: value.name,
      reviewCount: value.reviewCount,
      recommendedCount: value.recommendedCount,
      recommendationPercentage: recommendationPercentage(value.recommendedCount, value.reviewCount),
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount || a.name.localeCompare(b.name));
}

export function aggregateHoursBuckets(reviews: ReviewAggInput[]): UserHoursBucketDto[] {
  const withHours = reviews.filter((review) => review.hoursPlayed !== null);
  return HOURS_BUCKETS.map((bucket) => {
    const matched = withHours.filter((review) => {
      const hours = review.hoursPlayed ?? 0;
      if (bucket.max === null) return hours >= bucket.min;
      return hours >= bucket.min && hours < bucket.max;
    });
    const recommendedCount = matched.filter((review) => review.recommended).length;
    return {
      bucket: bucket.bucket,
      count: matched.length,
      recommendedCount,
      notRecommendedCount: matched.length - recommendedCount,
    };
  });
}

export function buildTimeline(
  reviews: ReviewAggInput[],
  events: ReputationEventAggInput[],
  range: UserStatisticsRange,
): UserTimelinePointDto[] {
  const useMonths = range === 'all' || range === '12m';
  const reviewBuckets = new Map<string, { reviews: number; recommendedCount: number }>();

  for (const review of reviews) {
    const key = bucketKey(review.createdAt, useMonths);
    const current = reviewBuckets.get(key) ?? { reviews: 0, recommendedCount: 0 };
    current.reviews += 1;
    if (review.recommended) current.recommendedCount += 1;
    reviewBuckets.set(key, current);
  }

  const reputationByBucket = new Map<string, number>();
  const sortedEvents = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const event of sortedEvents) {
    reputationByBucket.set(bucketKey(event.createdAt, useMonths), event.balanceAfter);
  }

  const keys = new Set([...reviewBuckets.keys(), ...reputationByBucket.keys()]);
  return [...keys]
    .sort()
    .map((date) => {
      const reviewsBucket = reviewBuckets.get(date) ?? { reviews: 0, recommendedCount: 0 };
      return {
        date,
        reviews: reviewsBucket.reviews,
        recommendedCount: reviewsBucket.recommendedCount,
        recommendationPercentage: recommendationPercentage(
          reviewsBucket.recommendedCount,
          reviewsBucket.reviews,
        ),
        reputationScore: reputationByBucket.get(date) ?? null,
      };
    });
}

function bucketKey(date: Date, useMonths: boolean): string {
  const iso = date.toISOString();
  return useMonths ? `${iso.slice(0, 7)}-01` : iso.slice(0, 10);
}

export function buildActivity(reviews: ReviewAggInput[]): UserActivityDto {
  if (reviews.length === 0) {
    return { activeMonths: 0, reviewsPerMonth: 0 };
  }
  const months = new Set(reviews.map((review) => review.createdAt.toISOString().slice(0, 7)));
  const activeMonths = months.size;
  return {
    activeMonths,
    reviewsPerMonth: Math.round((reviews.length / activeMonths) * 100) / 100,
  };
}

export function buildTopUsefulReviews(reviews: ReviewAggInput[], limit = 5): UserTopReviewDto[] {
  return [...reviews]
    .sort(
      (a, b) =>
        b.usefulCount - a.usefulCount || b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .filter((review) => review.usefulCount > 0)
    .slice(0, limit)
    .map((review) => ({
      id: review.id,
      gameId: review.gameId,
      gameSlug: review.gameSlug,
      gameName: review.gameName,
      gameCoverImageUrl: review.gameCoverImageUrl,
      recommended: review.recommended,
      usefulCount: review.usefulCount,
      notUsefulCount: review.notUsefulCount,
      textPreview: review.text.slice(0, 160),
      createdAt: review.createdAt.toISOString(),
    }));
}

export function buildReputationSummary(
  score: number,
  events: ReputationEventAggInput[],
  includeSensitive: boolean,
): UserReputationSummaryDto {
  const breakdown: UserReputationBreakdownDto = {
    usefulVotesReceived: 0,
    notUsefulVotesReceived: 0,
    reviewsPublished: 0,
    reviewsDeleted: 0,
  };

  let moderationNet = 0;
  let moderationPenalties = 0;

  for (const event of events) {
    const reason = event.reason as ReputationReason;
    if (isSensitiveReputationReason(reason)) {
      moderationNet += event.delta;
      moderationPenalties += Math.abs(event.delta);
      continue;
    }
    switch (reason) {
      case 'USEFUL_VOTE_RECEIVED':
        breakdown.usefulVotesReceived += 1;
        break;
      case 'NOT_USEFUL_VOTE_RECEIVED':
        breakdown.notUsefulVotesReceived += 1;
        break;
      case 'REVIEW_PUBLISHED':
        breakdown.reviewsPublished += 1;
        break;
      case 'REVIEW_DELETED':
        breakdown.reviewsDeleted += 1;
        break;
      default:
        break;
    }
  }

  if (includeSensitive) {
    breakdown.moderationPenalties = moderationPenalties;
  }

  return {
    score,
    tier: reputationTier(score),
    rankingWeightRatio: Math.round(reputationRankingWeightRatio(score) * 1000) / 1000,
    breakdown,
    moderationNet: includeSensitive || moderationNet === 0 ? null : moderationNet,
  };
}

export function userStatsCacheKey(userId: string, range: UserStatisticsRange): string {
  return `${USER_STATS_CACHE_PREFIX}${userId}:${range}`;
}
