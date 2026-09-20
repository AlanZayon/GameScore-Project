/**
 * Reputation rules.
 *
 * Reputation exists to surface people who consistently write reviews others
 * find useful. It is deliberately bounded: it feeds only a capped term of the
 * review ranking score, and it can never become a popularity ratchet.
 */

import { REVIEW_SCORE_REPUTATION_SOFT_CAP } from './review-score';

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

/**
 * Moderation penalties are hidden from the public reputation ledger.
 * Moderators and admins still see them.
 */
export const SENSITIVE_REPUTATION_REASONS = [
  'REVIEW_REMOVED_BY_MODERATOR',
  'ABUSE_CONFIRMED',
] as const satisfies ReadonlyArray<ReputationReason>;

export type SensitiveReputationReason = (typeof SENSITIVE_REPUTATION_REASONS)[number];

export function isSensitiveReputationReason(reason: string): reason is SensitiveReputationReason {
  return (SENSITIVE_REPUTATION_REASONS as ReadonlyArray<string>).includes(reason);
}

/** Public reputation tiers shown on player profiles (translated in the UI). */
export const REPUTATION_TIERS = [
  'NEWCOMER',
  'ACTIVE',
  'TRUSTED',
  'ESTABLISHED',
  'RESPECTED',
  'ELITE',
] as const;

export type ReputationTier = (typeof REPUTATION_TIERS)[number];

const REPUTATION_TIER_THRESHOLDS: Array<{ tier: ReputationTier; min: number }> = [
  { tier: 'ELITE', min: 3000 },
  { tier: 'RESPECTED', min: 1500 },
  { tier: 'ESTABLISHED', min: 500 },
  { tier: 'TRUSTED', min: 200 },
  { tier: 'ACTIVE', min: 50 },
  { tier: 'NEWCOMER', min: 0 },
];

/** Reputation is clamped rather than allowed to run away in either direction. */
export function clampReputation(value: number): number {
  if (!Number.isFinite(value)) return REPUTATION_MIN;
  return Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, Math.trunc(value)));
}

export function applyReputationDelta(current: number, reason: ReputationReason): number {
  return clampReputation(current + REPUTATION_DELTAS[reason]);
}

export function reputationTier(score: number): ReputationTier {
  const clamped = clampReputation(score);
  for (const entry of REPUTATION_TIER_THRESHOLDS) {
    if (clamped >= entry.min) return entry.tier;
  }
  return 'NEWCOMER';
}

/**
 * How much of the review-ranking reputation weight this score already earns,
 * as a 0..1 ratio against the soft cap (500 → full weight).
 */
export function reputationRankingWeightRatio(score: number): number {
  const clamped = Math.max(0, clampReputation(score));
  return Math.min(1, clamped / REVIEW_SCORE_REPUTATION_SOFT_CAP);
}
