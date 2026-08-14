/**
 * Wilson score interval.
 *
 * The GameScore rating is a proportion of positive recommendations, and a raw
 * proportion is a terrible ranking key: 1 positive out of 1 is 100%, yet it
 * carries almost no evidence. The Wilson lower bound answers a better question:
 * "given this sample, what is the lowest plausible true positive rate?".
 * Small samples get pulled hard toward zero, large samples barely move, so
 * volume of evidence is respected without any arbitrary fudge factor.
 */

/** z value for a 95% one-sided confidence level. */
export const WILSON_Z_95 = 1.959963984540054;

/** z value for a 90% confidence level, kept for experimentation. */
export const WILSON_Z_90 = 1.6448536269514722;

function assertCount(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0, received ${value}`);
  }
}

function clampToUnitInterval(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Lower bound of the Wilson confidence interval for the positive proportion,
 * returned in the 0..1 range.
 *
 * With no reviews at all the result is 0: an unrated game has no evidence of
 * being good, which is exactly how it should be ranked.
 */
export function wilsonLowerBound(
  positive: number,
  negative: number,
  z: number = WILSON_Z_95,
): number {
  assertCount(positive, 'positive');
  assertCount(negative, 'negative');

  const total = positive + negative;
  if (total === 0) {
    return 0;
  }

  const observed = positive / total;
  const zSquared = z * z;

  const centre = observed + zSquared / (2 * total);
  const margin = z * Math.sqrt((observed * (1 - observed) + zSquared / (4 * total)) / total);
  const denominator = 1 + zSquared / total;

  return clampToUnitInterval((centre - margin) / denominator);
}

/**
 * Upper bound of the same interval. Used when reasoning about how much a score
 * could still move, for example when deciding whether a game has settled.
 */
export function wilsonUpperBound(
  positive: number,
  negative: number,
  z: number = WILSON_Z_95,
): number {
  assertCount(positive, 'positive');
  assertCount(negative, 'negative');

  const total = positive + negative;
  if (total === 0) {
    return 0;
  }

  const observed = positive / total;
  const zSquared = z * z;

  const centre = observed + zSquared / (2 * total);
  const margin = z * Math.sqrt((observed * (1 - observed) + zSquared / (4 * total)) / total);
  const denominator = 1 + zSquared / total;

  return clampToUnitInterval((centre + margin) / denominator);
}
