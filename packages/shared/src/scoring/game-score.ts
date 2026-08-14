import {
  DEFAULT_SCORE_LABEL_MINIMUM_REVIEWS,
  resolveScoreLabel,
  type ScoreLabel,
} from './score-label';
import { wilsonLowerBound } from './wilson';

export interface RecommendationCounts {
  positive: number;
  negative: number;
}

export interface GameScoreResult {
  /** Number of reviews taken into account. */
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  /** What users see: the raw positive share, 0..100 with two decimals. */
  positivePercentage: number;
  /** Raw Wilson lower bound, 0..1. Kept for transparency and debugging. */
  wilsonLowerBound: number;
  /**
   * Ranking key: the Wilson lower bound normalised to 0..100.
   * Deliberately not the number shown to users.
   */
  confidenceScore: number;
  label: ScoreLabel;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Turns raw recommendation counts into everything the product needs: the
 * user-facing percentage, the internal confidence score used for ordering,
 * and the translatable label.
 */
export function calculateGameScore(
  counts: RecommendationCounts,
  minimumReviewsForLabel: number = DEFAULT_SCORE_LABEL_MINIMUM_REVIEWS,
): GameScoreResult {
  const positive = Math.max(0, Math.trunc(counts.positive));
  const negative = Math.max(0, Math.trunc(counts.negative));
  const total = positive + negative;

  const positivePercentage = total === 0 ? 0 : roundTo((positive / total) * 100, 2);
  const lowerBound = wilsonLowerBound(positive, negative);

  return {
    totalReviews: total,
    positiveReviews: positive,
    negativeReviews: negative,
    positivePercentage,
    wilsonLowerBound: roundTo(lowerBound, 6),
    confidenceScore: roundTo(lowerBound * 100, 4),
    label: resolveScoreLabel(positivePercentage, total, minimumReviewsForLabel),
  };
}
