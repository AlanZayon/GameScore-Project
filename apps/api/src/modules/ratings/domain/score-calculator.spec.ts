import {
  calculateGameScore,
  resolveScoreLabel,
  wilsonLowerBound,
  WILSON_Z_95,
} from '@gamescore/shared';

/**
 * These tests are the contract of the whole product: the score must reward
 * evidence, not just ratio. Every case required by the specification is here,
 * plus the properties that keep the ranking honest.
 */
describe('Wilson score', () => {
  describe('required cases', () => {
    it('barely trusts a single positive review', () => {
      const score = calculateGameScore({ positive: 1, negative: 0 });

      expect(score.positivePercentage).toBe(100);
      // 100% positive, yet the confidence score is low enough that this game
      // cannot lead any ranking.
      expect(score.confidenceScore).toBeLessThan(25);
      expect(score.label).toBe('FEW_REVIEWS');
    });

    it('rewards ten positive reviews more than one', () => {
      const one = calculateGameScore({ positive: 1, negative: 0 });
      const ten = calculateGameScore({ positive: 10, negative: 0 });

      expect(ten.positivePercentage).toBe(100);
      expect(ten.confidenceScore).toBeGreaterThan(one.confidenceScore);
      expect(ten.confidenceScore).toBeLessThan(80);
    });

    it('scores 100 positive against 10 negative', () => {
      const score = calculateGameScore({ positive: 100, negative: 10 });

      expect(score.positivePercentage).toBeCloseTo(90.91, 2);
      expect(score.confidenceScore).toBeGreaterThan(83);
      expect(score.confidenceScore).toBeLessThan(91);
      expect(score.label).toBe('VERY_POSITIVE');
    });

    it('scores 10000 positive against 1000 negative close to the raw ratio', () => {
      const score = calculateGameScore({ positive: 10_000, negative: 1_000 });

      expect(score.positivePercentage).toBeCloseTo(90.91, 2);
      // With this much evidence the confidence score sits just below the
      // observed percentage instead of far below it.
      expect(score.confidenceScore).toBeGreaterThan(90);
      expect(score.confidenceScore).toBeLessThan(90.91);
    });

    it('ranks the same ratio by amount of evidence', () => {
      const small = calculateGameScore({ positive: 9, negative: 1 });
      const large = calculateGameScore({ positive: 9_000, negative: 1_000 });

      expect(small.positivePercentage).toBe(large.positivePercentage);
      expect(large.confidenceScore).toBeGreaterThan(small.confidenceScore);
    });

    it('never lets a perfect tiny sample outrank a large strong one', () => {
      const perfectTiny = calculateGameScore({ positive: 10, negative: 0 });
      const strongLarge = calculateGameScore({ positive: 9_500, negative: 500 });

      expect(perfectTiny.positivePercentage).toBeGreaterThan(strongLarge.positivePercentage);
      expect(strongLarge.confidenceScore).toBeGreaterThan(perfectTiny.confidenceScore);
    });
  });

  describe('mathematical properties', () => {
    it('returns zero with no reviews', () => {
      const score = calculateGameScore({ positive: 0, negative: 0 });

      expect(score.confidenceScore).toBe(0);
      expect(score.positivePercentage).toBe(0);
      expect(score.label).toBe('NO_REVIEWS');
    });

    it('matches the closed form of the Wilson lower bound', () => {
      const positive = 80;
      const negative = 20;
      const total = positive + negative;
      const p = positive / total;
      const z = WILSON_Z_95;
      const expected =
        (p +
          (z * z) / (2 * total) -
          z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) /
        (1 + (z * z) / total);

      expect(wilsonLowerBound(positive, negative)).toBeCloseTo(expected, 12);
    });

    it('stays within the unit interval', () => {
      for (const [positive, negative] of [
        [0, 1],
        [1, 0],
        [0, 1_000],
        [1_000, 0],
        [1, 1],
        [500, 500],
      ]) {
        const bound = wilsonLowerBound(positive!, negative!);
        expect(bound).toBeGreaterThanOrEqual(0);
        expect(bound).toBeLessThanOrEqual(1);
      }
    });

    it('increases monotonically as positives accumulate at a fixed ratio', () => {
      const bounds = [10, 100, 1_000, 10_000].map(
        (scale) => calculateGameScore({ positive: scale * 9, negative: scale }).confidenceScore,
      );

      for (let index = 1; index < bounds.length; index += 1) {
        expect(bounds[index]!).toBeGreaterThan(bounds[index - 1]!);
      }
    });

    it('is always below the observed percentage', () => {
      for (const [positive, negative] of [
        [9, 1],
        [90, 10],
        [900, 100],
        [1, 1],
      ]) {
        const score = calculateGameScore({ positive: positive!, negative: negative! });
        expect(score.confidenceScore).toBeLessThan(score.positivePercentage);
      }
    });

    it('treats an all-negative game as the worst case', () => {
      const score = calculateGameScore({ positive: 0, negative: 500 });

      expect(score.positivePercentage).toBe(0);
      expect(score.confidenceScore).toBe(0);
      expect(score.label).toBe('VERY_NEGATIVE');
    });

    it('rejects nonsensical input', () => {
      expect(() => wilsonLowerBound(-1, 0)).toThrow(RangeError);
      expect(() => wilsonLowerBound(0, Number.NaN)).toThrow(RangeError);
    });
  });

  describe('score labels', () => {
    it('withholds a confident label until there is enough evidence', () => {
      expect(resolveScoreLabel(100, 3)).toBe('FEW_REVIEWS');
      expect(resolveScoreLabel(100, 10)).toBe('VERY_POSITIVE');
    });

    it('reserves the strongest label for large, near-unanimous samples', () => {
      expect(resolveScoreLabel(96, 50)).toBe('VERY_POSITIVE');
      expect(resolveScoreLabel(96, 200)).toBe('OVERWHELMINGLY_POSITIVE');
    });

    it('maps the middle of the range to mixed', () => {
      expect(resolveScoreLabel(50, 100)).toBe('MIXED');
      expect(resolveScoreLabel(44, 100)).toBe('MOSTLY_NEGATIVE');
      expect(resolveScoreLabel(61, 100)).toBe('MOSTLY_POSITIVE');
    });
  });
});
