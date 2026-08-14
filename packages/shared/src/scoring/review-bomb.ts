/**
 * Review bomb detection.
 *
 * A review bomb is a sudden, heavily one-sided spike in review volume, usually
 * a reaction to something outside the game itself. The detector compares one
 * day against the game's own recent baseline, so a popular game that normally
 * gets 400 reviews a day is not flagged for doing exactly that.
 *
 * Detection never deletes anything: it records an event for a human to judge.
 */

export interface DailyReviewActivity {
  /** ISO date (YYYY-MM-DD) of the bucket. */
  date: string;
  positive: number;
  negative: number;
}

export type ReviewBombDirection = 'NEGATIVE' | 'POSITIVE' | 'NONE';

export interface ReviewBombAssessment {
  anomalous: boolean;
  direction: ReviewBombDirection;
  /** Reviews observed on the assessed day. */
  observed: number;
  positive: number;
  negative: number;
  /** Typical daily volume derived from the baseline window. */
  baselinePerDay: number;
  /** observed / baseline, capped for reporting sanity. */
  volumeRatio: number;
  /** Share of the dominant polarity, 0..1. */
  dominantShare: number;
  /** 0..1 severity used to prioritise moderation queues. */
  severity: number;
}

/** A day quieter than this is never a bomb, however large the ratio looks. */
export const REVIEW_BOMB_MIN_ABSOLUTE_REVIEWS = 20;

/** How many times above baseline a day must be to count as a spike. */
export const REVIEW_BOMB_VOLUME_RATIO_THRESHOLD = 5;

/** Minimum one-sidedness for a negative spike. */
export const REVIEW_BOMB_NEGATIVE_SHARE_THRESHOLD = 0.7;

/** Positive brigading is rarer, so it needs to be more blatant. */
export const REVIEW_BOMB_POSITIVE_SHARE_THRESHOLD = 0.9;

/** Days of history used to establish what "normal" looks like. */
export const REVIEW_BOMB_BASELINE_WINDOW_DAYS = 30;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * The median is used rather than the mean so a previous spike inside the
 * baseline window cannot quietly raise the bar and mask the next one.
 */
export function calculateBaselinePerDay(history: DailyReviewActivity[]): number {
  const totals = history.map((day) => day.positive + day.negative);
  return median(totals);
}

export function assessReviewBomb(
  day: DailyReviewActivity,
  baselineHistory: DailyReviewActivity[],
): ReviewBombAssessment {
  const positive = Math.max(0, day.positive);
  const negative = Math.max(0, day.negative);
  const observed = positive + negative;

  const baselinePerDay = calculateBaselinePerDay(baselineHistory);
  // A brand new game has no baseline; treat it as 1/day so the absolute
  // threshold is what protects it from false positives.
  const effectiveBaseline = Math.max(baselinePerDay, 1);
  const volumeRatio = observed === 0 ? 0 : observed / effectiveBaseline;

  const negativeShare = observed === 0 ? 0 : negative / observed;
  const positiveShare = observed === 0 ? 0 : positive / observed;

  const isNegativeSpike = negativeShare >= REVIEW_BOMB_NEGATIVE_SHARE_THRESHOLD;
  const isPositiveSpike = positiveShare >= REVIEW_BOMB_POSITIVE_SHARE_THRESHOLD;

  const meetsVolume =
    observed >= REVIEW_BOMB_MIN_ABSOLUTE_REVIEWS &&
    volumeRatio >= REVIEW_BOMB_VOLUME_RATIO_THRESHOLD;

  const direction: ReviewBombDirection = !meetsVolume
    ? 'NONE'
    : isNegativeSpike
      ? 'NEGATIVE'
      : isPositiveSpike
        ? 'POSITIVE'
        : 'NONE';

  const anomalous = direction !== 'NONE';
  const dominantShare = direction === 'POSITIVE' ? positiveShare : negativeShare;

  // Severity blends how big the spike is with how one-sided it is, both
  // normalised, so a moderator can sort the queue by "how bad is this".
  const ratioComponent = clamp01(Math.min(volumeRatio, 50) / 50);
  const shareComponent = clamp01((dominantShare - 0.5) / 0.5);
  const severity = anomalous ? clamp01(ratioComponent * 0.6 + shareComponent * 0.4) : 0;

  return {
    anomalous,
    direction,
    observed,
    positive,
    negative,
    baselinePerDay,
    volumeRatio: Number.isFinite(volumeRatio) ? Math.min(volumeRatio, 1000) : 0,
    dominantShare,
    severity,
  };
}
