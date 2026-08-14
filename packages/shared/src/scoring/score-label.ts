/**
 * Score labels are returned by the API as stable codes and translated in the
 * frontend, so the same rating reads correctly in every supported locale.
 */
export const SCORE_LABELS = [
  'NO_REVIEWS',
  'FEW_REVIEWS',
  'OVERWHELMINGLY_POSITIVE',
  'VERY_POSITIVE',
  'POSITIVE',
  'MOSTLY_POSITIVE',
  'MIXED',
  'MOSTLY_NEGATIVE',
  'NEGATIVE',
  'VERY_NEGATIVE',
] as const;

export type ScoreLabel = (typeof SCORE_LABELS)[number];

/** Sentiment bucket used for colour coding in the UI. */
export type ScoreSentiment = 'positive' | 'mixed' | 'negative' | 'unknown';

/**
 * Below this many reviews a game gets the neutral `FEW_REVIEWS` label instead
 * of a confident one. A single glowing review must never read as "acclaimed".
 */
export const DEFAULT_SCORE_LABEL_MINIMUM_REVIEWS = 10;

/**
 * The strongest label additionally requires a large sample, so it stays a
 * meaningful distinction rather than something 12 friendly reviews can buy.
 */
export const OVERWHELMING_LABEL_MINIMUM_REVIEWS = 200;

/**
 * Resolves the display label for a game from its positive percentage and the
 * size of its sample.
 *
 * @param positivePercentage positive share of reviews, 0..100
 * @param totalReviews number of reviews backing that percentage
 */
export function resolveScoreLabel(
  positivePercentage: number,
  totalReviews: number,
  minimumReviews: number = DEFAULT_SCORE_LABEL_MINIMUM_REVIEWS,
): ScoreLabel {
  if (totalReviews <= 0) {
    return 'NO_REVIEWS';
  }
  if (totalReviews < minimumReviews) {
    return 'FEW_REVIEWS';
  }
  if (positivePercentage >= 95 && totalReviews >= OVERWHELMING_LABEL_MINIMUM_REVIEWS) {
    return 'OVERWHELMINGLY_POSITIVE';
  }
  if (positivePercentage >= 85) {
    return 'VERY_POSITIVE';
  }
  if (positivePercentage >= 75) {
    return 'POSITIVE';
  }
  if (positivePercentage >= 60) {
    return 'MOSTLY_POSITIVE';
  }
  if (positivePercentage >= 45) {
    return 'MIXED';
  }
  if (positivePercentage >= 30) {
    return 'MOSTLY_NEGATIVE';
  }
  if (positivePercentage >= 15) {
    return 'NEGATIVE';
  }
  return 'VERY_NEGATIVE';
}

export function resolveScoreSentiment(label: ScoreLabel): ScoreSentiment {
  switch (label) {
    case 'OVERWHELMINGLY_POSITIVE':
    case 'VERY_POSITIVE':
    case 'POSITIVE':
    case 'MOSTLY_POSITIVE':
      return 'positive';
    case 'MIXED':
      return 'mixed';
    case 'MOSTLY_NEGATIVE':
    case 'NEGATIVE':
    case 'VERY_NEGATIVE':
      return 'negative';
    default:
      return 'unknown';
  }
}
