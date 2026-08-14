import type { GameSummaryDto } from './games';

export interface SearchGamesQuery {
  q: string;
  page?: number;
  limit?: number;
  platformSlug?: string;
  genreSlug?: string;
}

export interface SearchResultDto {
  query: string;
  items: GameSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Which provider answered, so the abstraction is observable in responses. */
  provider: string;
  tookMs: number;
}

/** Lightweight payload for the type-ahead dropdown. */
export interface AutocompleteItemDto {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  positivePercentage: number | null;
  totalReviews: number;
}
