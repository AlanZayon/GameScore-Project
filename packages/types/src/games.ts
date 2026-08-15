import type { PlatformFamily, ScoreLabel } from '@gamescore/shared';

export interface PlatformDto {
  id: string;
  slug: string;
  name: string;
  abbreviation: string;
  family: PlatformFamily;
}

export interface GenreDto {
  id: string;
  slug: string;
  name: string;
}

/**
 * The rating block. `positivePercentage` is what users read; `confidenceScore`
 * is the Wilson-derived key used for ordering and is not meant to be displayed.
 */
export interface GameScoreDto {
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  positivePercentage: number;
  confidenceScore: number;
  label: ScoreLabel;
  /** Average of the optional 0-10 ratings, null when nobody supplied one. */
  averageRating: number | null;
  ratingCount: number;
}

/** Card-sized game payload used by listings, rankings and search. */
export interface GameSummaryDto {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  platforms: PlatformDto[];
  genres: GenreDto[];
  score: GameScoreDto;
}

export interface GameDetailDto extends GameSummaryDto {
  summary: string | null;
  description: string | null;
  bannerImageUrl: string | null;
  /** YouTube video id for the trailer, when IGDB provided one. */
  trailerYoutubeId: string | null;
  /** Screenshot URLs shown as a carousel when there is no trailer. */
  galleryImageUrls: string[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  /** Present only when the caller is authenticated and has reviewed the game. */
  viewerReviewId: string | null;
  /** True when at least one unresolved review bomb event exists. */
  hasReviewBombEvents: boolean;
  /** DLCs / expansions linked via IGDB (metadata only until imported). */
  related: GameRelatedItemDto[];
}

export type GameRelationKind = 'DLC' | 'EXPANSION' | 'BUNDLE' | 'SIMILAR';

export interface GameRelatedItemDto {
  kind: GameRelationKind;
  provider: 'IGDB';
  externalId: string;
  name: string;
  coverImageUrl: string | null;
  releaseDate: string | null;
  /** Local catalogue slug when this related title is already imported. */
  localSlug: string | null;
}

export interface PlatformScoreDto {
  platform: PlatformDto;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  positivePercentage: number;
  confidenceScore: number;
  label: ScoreLabel;
}

/** Aggregated Wilson score for a platform family (PC, PlayStation, …). */
export interface PlatformFamilyScoreDto {
  family: PlatformFamily;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  positivePercentage: number;
  confidenceScore: number;
  label: ScoreLabel;
}

export interface ReviewTimelinePointDto {
  /** ISO date, one bucket per day. */
  date: string;
  positive: number;
  negative: number;
  total: number;
}

export interface ReviewBombEventSummaryDto {
  id: string;
  startAt: string;
  endAt: string;
  positiveCount: number;
  negativeCount: number;
  severity: number;
  status: string;
}

export interface GameStatisticsDto {
  gameId: string;
  slug: string;
  score: GameScoreDto;
  /**
   * Same figures with reviews inside confirmed review bomb windows removed.
   * Null when the game has no such windows.
   */
  scoreExcludingReviewBombs: GameScoreDto | null;
  platforms: PlatformScoreDto[];
  /** Platform rows rolled up by `Platform.family`. */
  families: PlatformFamilyScoreDto[];
  timeline: ReviewTimelinePointDto[];
  reviewBombEvents: ReviewBombEventSummaryDto[];
  hoursPlayedDistribution: HoursPlayedBucketDto[];
  lastCalculatedAt: string;
}

export interface HoursPlayedBucketDto {
  /** Human readable bucket key, e.g. `0-2`, `2-10`, `10-50`, `50+`. */
  bucket: string;
  count: number;
  positive: number;
  negative: number;
}

export interface GameScoreSnapshotDto {
  date: string;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  confidenceScore: number;
  positivePercentage: number;
}
