import type { GameSummaryDto } from './games';

export interface RankingEntryDto {
  position: number;
  game: GameSummaryDto;
  /** Value the ranking was ordered by, exposed so the UI can explain itself. */
  rankingValue: number;
}

export interface RankingResponseDto {
  /** Identifier of the ranking, e.g. `top-rated`, `trending`, `new-releases`. */
  ranking: string;
  /** Human-meaningful description of the criteria, as a translation key. */
  criteriaKey: string;
  /** Minimum number of reviews a game needed to qualify, when applicable. */
  minimumReviews: number | null;
  entries: RankingEntryDto[];
  generatedAt: string;
}

export interface HomeFeedDto {
  popular: GameSummaryDto[];
  topRated: GameSummaryDto[];
  newReleases: GameSummaryDto[];
  trending: GameSummaryDto[];
  recentReviews: HomeRecentReviewDto[];
  totals: {
    games: number;
    reviews: number;
    users: number;
  };
}

export interface HomeRecentReviewDto {
  id: string;
  gameSlug: string;
  gameName: string;
  gameCoverImageUrl: string | null;
  authorUsername: string;
  authorAvatarUrl: string | null;
  recommended: boolean;
  excerpt: string;
  createdAt: string;
}
