import { createHash } from 'node:crypto';

import { normaliseForComparison } from '@gamescore/shared';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Hash of the normalised review body, used to spot copy-pasted reviews. */
export function reviewFingerprint(text: string): string {
  return sha256(normaliseForComparison(text));
}

/**
 * One-way hash of a client IP. The secret is mixed in so a leaked hash cannot
 * be reversed into an address, and the raw IP is never stored.
 */
export function hashClientIp(ip: string | undefined, secret: string): string | null {
  if (!ip) return null;
  const normalised = ip.replace(/^::ffff:/, '').trim();
  if (!normalised || normalised === 'unknown') return null;
  return sha256(`${secret}:ip:${normalised}`);
}

/** Calendar date in UTC, matching PostgreSQL `date` columns. */
export function utcDate(value: Date = new Date()): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function isoDate(value: Date): string {
  return utcDate(value).toISOString().slice(0, 10);
}
