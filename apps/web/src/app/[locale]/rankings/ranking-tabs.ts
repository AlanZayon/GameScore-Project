export const RANKING_TABS = [
  { id: 'top-rated', path: '/rankings/top-rated' },
  { id: 'trending', path: '/rankings/trending' },
  { id: 'new-releases', path: '/rankings/new-releases' },
  { id: 'popular', path: '/rankings/popular' },
] as const;

export type RankingTabId = (typeof RANKING_TABS)[number]['id'];

export function resolveRankingTab(raw?: string): RankingTabId {
  return RANKING_TABS.some((item) => item.id === raw) ? (raw as RankingTabId) : 'top-rated';
}
