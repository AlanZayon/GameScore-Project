import { calculateGameScore, resolveScoreLabel, type ScoreLabel } from '@gamescore/shared';
import type {
  GameDetailDto,
  GameScoreDto,
  GameSummaryDto,
  GenreDto,
  PlatformDto,
} from '@gamescore/types';
import type { Game, GameStatistics, Genre, Platform } from '@prisma/client';

export type GameWithRelations = Game & {
  platforms: Array<{ platformId: string; platform: Platform }>;
  genres: Array<{ genre: Genre }>;
  statistics: GameStatistics | null;
};

export function toPlatformDto(platform: Platform): PlatformDto {
  return {
    id: platform.id,
    slug: platform.slug,
    name: platform.name,
    abbreviation: platform.abbreviation,
    family: platform.family,
  };
}

export function toGenreDto(genre: Genre): GenreDto {
  return {
    id: genre.id,
    slug: genre.slug,
    name: genre.name,
  };
}

export function toGameScoreDto(
  statistics: GameStatistics | null,
  minimumReviewsForLabel: number,
): GameScoreDto {
  if (!statistics) {
    const empty = calculateGameScore({ positive: 0, negative: 0 }, minimumReviewsForLabel);
    return {
      totalReviews: empty.totalReviews,
      positiveReviews: empty.positiveReviews,
      negativeReviews: empty.negativeReviews,
      positivePercentage: empty.positivePercentage,
      confidenceScore: empty.confidenceScore,
      label: empty.label,
      averageRating: null,
      ratingCount: 0,
    };
  }

  return {
    totalReviews: statistics.totalReviews,
    positiveReviews: statistics.positiveReviews,
    negativeReviews: statistics.negativeReviews,
    positivePercentage: statistics.positivePercentage,
    confidenceScore: statistics.confidenceScore,
    label: resolveScoreLabel(
      statistics.positivePercentage,
      statistics.totalReviews,
      minimumReviewsForLabel,
    ),
    averageRating: statistics.averageRating,
    ratingCount: statistics.ratingCount,
  };
}

export function toGameSummaryDto(
  game: GameWithRelations,
  minimumReviewsForLabel: number,
): GameSummaryDto {
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    coverImageUrl: game.coverImageUrl,
    releaseDate: game.releaseDate ? game.releaseDate.toISOString().slice(0, 10) : null,
    developer: game.developer,
    publisher: game.publisher,
    platforms: game.platforms
      .map((link) => toPlatformDto(link.platform))
      .sort((a, b) => a.name.localeCompare(b.name)),
    genres: game.genres
      .map((link) => toGenreDto(link.genre))
      .sort((a, b) => a.name.localeCompare(b.name)),
    score: toGameScoreDto(game.statistics, minimumReviewsForLabel),
  };
}

export function toGameDetailDto(
  game: GameWithRelations,
  extras: {
    viewerReviewId: string | null;
    hasReviewBombEvents: boolean;
    minimumReviewsForLabel: number;
  },
): GameDetailDto {
  return {
    ...toGameSummaryDto(game, extras.minimumReviewsForLabel),
    summary: game.summary,
    description: game.description,
    bannerImageUrl: game.bannerImageUrl,
    viewCount: game.viewCount,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    viewerReviewId: extras.viewerReviewId,
    hasReviewBombEvents: extras.hasReviewBombEvents,
  };
}

export function labelFromCounts(
  positivePercentage: number,
  totalReviews: number,
  minimumReviewsForLabel: number,
): ScoreLabel {
  return resolveScoreLabel(positivePercentage, totalReviews, minimumReviewsForLabel);
}
