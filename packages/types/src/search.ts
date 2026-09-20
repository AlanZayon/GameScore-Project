import type { ExternalProvider } from '@gamescore/shared';

import type { GameSummaryDto } from './games';

export interface SearchGamesQuery {
  q: string;
  page?: number;
  limit?: number;
  platformSlug?: string;
  genreSlug?: string;
}

export type SearchHitSource = 'local' | 'igdb';

/** IGDB (or other provider) hit that is not yet in the local catalogue. */
export interface ExternalGameHitDto {
  externalId: string;
  provider: ExternalProvider;
  name: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  summary: string | null;
}

/** Full preview of an external game before it is imported (import happens on first review). */
export interface ExternalGamePreviewDto {
  externalId: string;
  provider: ExternalProvider;
  name: string;
  summary: string | null;
  description: string | null;
  coverImageUrl: string | null;
  bannerImageUrl: string | null;
  /** YouTube video id from IGDB, when available. */
  trailerYoutubeId: string | null;
  /** Screenshot URLs from IGDB (same hosts as imported games). */
  galleryImageUrls: string[];
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  platforms: Array<{ name: string; abbreviation: string }>;
  genres: Array<{ name: string }>;
  /** When already imported, the client should redirect to this local slug. */
  localSlug: string | null;
}

export interface SearchResultDto {
  query: string;
  items: GameSummaryDto[];
  /** Not-yet-imported matches from an external catalogue (shown when local results are thin). */
  externalItems: ExternalGameHitDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Which provider answered the local catalogue query. */
  provider: string;
  /** Which catalogues contributed to this response. */
  sources: SearchHitSource[];
  tookMs: number;
}

/** Lightweight payload for the type-ahead dropdown. */
export interface AutocompleteItemDto {
  id: string;
  /** Null when the game still needs to be imported from an external provider. */
  slug: string | null;
  name: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  positivePercentage: number | null;
  totalReviews: number;
  source: SearchHitSource;
  /** Present when `source` is `igdb`. */
  externalId?: string;
}

export interface ImportExternalGameRequest {
  externalId: string;
  provider?: ExternalProvider;
}
