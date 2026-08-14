/**
 * Text helpers used by the anti-spam rules. Kept pure and framework free so
 * they can be unit tested and reused from either side of the stack.
 */

/**
 * Normalises a review body for duplicate detection: case, accents, punctuation
 * and whitespace are stripped so "Great game!!!" and "great game" collapse to
 * the same fingerprint.
 */
export function normaliseForComparison(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ratio of distinct characters, a cheap way to catch "aaaaaaaaaa" padding. */
export function characterDiversity(text: string): number {
  const stripped = normaliseForComparison(text).replace(/\s/g, '');
  if (stripped.length === 0) return 0;
  return new Set(stripped).size / stripped.length;
}

/** Fraction of letters that are uppercase, ignoring non-letters. */
export function shoutingRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return 0;
  const uppercase = letters.replace(/[^A-Z]/g, '').length;
  return uppercase / letters.length;
}

export function wordCount(text: string): number {
  const normalised = normaliseForComparison(text);
  if (normalised.length === 0) return 0;
  return normalised.split(' ').length;
}
