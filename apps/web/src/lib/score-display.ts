import type { GameScoreDto } from '@gamescore/types';

/** Percentage is only meaningful once the label leaves FEW_REVIEWS. */
export function shouldShowScorePercentage(
  label: GameScoreDto['label'],
  totalReviews: number,
): boolean {
  return totalReviews > 0 && label !== 'FEW_REVIEWS' && label !== 'NO_REVIEWS';
}

export function formatScorePercentage(score: Pick<GameScoreDto, 'label' | 'totalReviews' | 'positivePercentage'>): string {
  return shouldShowScorePercentage(score.label, score.totalReviews)
    ? `${Math.round(score.positivePercentage)}%`
    : '—';
}

export function scoreBarWidth(score: Pick<GameScoreDto, 'label' | 'totalReviews' | 'positivePercentage'>): number {
  return shouldShowScorePercentage(score.label, score.totalReviews) ? score.positivePercentage : 0;
}
