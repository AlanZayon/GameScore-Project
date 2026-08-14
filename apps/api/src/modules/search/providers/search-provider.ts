import type { AutocompleteItemDto } from '@gamescore/types';

export interface SearchQuery {
  q: string;
  page: number;
  limit: number;
  platformSlug?: string;
  genreSlug?: string;
}

export interface SearchHit {
  gameId: string;
  rank: number;
}

export interface SearchHits {
  items: SearchHit[];
  total: number;
  tookMs: number;
}

export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchHits>;
  autocomplete(query: string, limit: number): Promise<AutocompleteItemDto[]>;
}

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');
