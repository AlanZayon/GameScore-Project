/**
 * Reputation rules.
 *
 * Reputation exists to surface people who consistently write reviews others
 * find useful. It is deliberately bounded: it feeds only a capped term of the
 * review ranking score, and it can never become a popularity ratchet.
 */

export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 5000;

export const REPUTATION_DELTAS = {
  /** Someone marked one of your reviews as useful. */
  USEFUL_VOTE_RECEIVED: 2,
  /** Someone marked one of your reviews as not useful. */
  NOT_USEFUL_VOTE_RECEIVED: -1,
  /** A useful vote on your review was taken back. */
  USEFUL_VOTE_REMOVED: -2,
  /** A not-useful vote on your review was taken back. */
  NOT_USEFUL_VOTE_REMOVED: 1,
  /** You published a review (small, one-off participation credit). */
  REVIEW_PUBLISHED: 1,
  /** You deleted your own review, so its participation credit is returned. */
  REVIEW_DELETED: -1,
  /** A moderator removed your review. */
  REVIEW_REMOVED_BY_MODERATOR: -25,
  /** A report against your review was confirmed as abuse or spam. */
  ABUSE_CONFIRMED: -50,
} as const;

export type ReputationReason = keyof typeof REPUTATION_DELTAS;

/** Reputation is clamped rather than allowed to run away in either direction. */
export function clampReputation(value: number): number {
  if (!Number.isFinite(value)) return REPUTATION_MIN;
  return Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, Math.trunc(value)));
}

export function applyReputationDelta(current: number, reason: ReputationReason): number {
  return clampReputation(current + REPUTATION_DELTAS[reason]);
}
