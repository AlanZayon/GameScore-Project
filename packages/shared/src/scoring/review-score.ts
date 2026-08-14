import { roundTo } from './game-score';
import { wilsonLowerBound } from './wilson';

/**
 * Review ordering.
 *
 * Sorting reviews by date buries the good ones, and sorting by raw useful votes
 * freezes the ranking in favour of whatever was posted first. The score below
 * mixes four explainable ingredients, each individually capped so no single one
 * can dominate. No machine learning, no hidden magic: every term can be
 * explained to a user in one sentence.
 */

export interface ReviewScoreInput {
  usefulVotes: number;
  notUsefulVotes: number;
  /** Author reputation at the time of scoring. */
  authorReputation: number;
  /** Length of the review body in characters. */
  textLength: number;
  /** Hours played, when the author provided it. */
  hoursPlayed?: number | null;
  /** Optional 0-10 rating, when the author provided it. */
  rating?: number | null;
  /** How old the review is, in days. */
  ageInDays: number;
}

export interface ReviewScoreBreakdown {
  usefulnessWeight: number;
  volumeWeight: number;
  reputationWeight: number;
  qualityWeight: number;
  recencyWeight: number;
  total: number;
}

export const REVIEW_SCORE_MAX_USEFULNESS = 50;
export const REVIEW_SCORE_MAX_VOLUME = 15;
export const REVIEW_SCORE_MAX_REPUTATION = 15;
export const REVIEW_SCORE_MAX_QUALITY = 12;
export const REVIEW_SCORE_MAX_RECENCY = 10;

/** Reputation that already earns the full reputation weight. */
export const REVIEW_SCORE_REPUTATION_SOFT_CAP = 500;

/** Days after which the recency bonus has decayed to roughly a third. */
export const REVIEW_SCORE_RECENCY_HALF_LIFE_DAYS = 90;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How much the community trusts this review, on the same statistical footing as
 * the game score itself: a review with 9/10 useful votes ranks below one with
 * 900/1000, which is the intended behaviour.
 */
function usefulnessWeight(usefulVotes: number, notUsefulVotes: number): number {
  return wilsonLowerBound(usefulVotes, notUsefulVotes) * REVIEW_SCORE_MAX_USEFULNESS;
}

/** Rewards reviews that many people bothered to vote on at all. */
function volumeWeight(totalVotes: number): number {
  return clamp(5 * Math.log10(1 + Math.max(0, totalVotes)), 0, REVIEW_SCORE_MAX_VOLUME);
}

/** Capped on purpose so a high-reputation author cannot coast on reputation. */
function reputationWeight(authorReputation: number): number {
  const normalised = Math.max(0, authorReputation) / REVIEW_SCORE_REPUTATION_SOFT_CAP;
  return clamp(normalised * REVIEW_SCORE_MAX_REPUTATION, 0, REVIEW_SCORE_MAX_REPUTATION);
}

/** Rewards effort: substantial text, and context such as hours and a rating. */
function qualityWeight(input: ReviewScoreInput): number {
  let score = 0;

  const length = Math.max(0, input.textLength);
  if (length >= 1200) score += 6;
  else if (length >= 600) score += 5;
  else if (length >= 250) score += 4;
  else if (length >= 120) score += 3;
  else if (length >= 60) score += 2;
  else if (length >= 20) score += 1;

  if (input.hoursPlayed != null && input.hoursPlayed > 0) score += 2;
  if (input.hoursPlayed != null && input.hoursPlayed >= 10) score += 2;
  if (input.rating != null) score += 2;

  return clamp(score, 0, REVIEW_SCORE_MAX_QUALITY);
}

/** Keeps the list alive without letting fresh reviews outrank proven ones. */
function recencyWeight(ageInDays: number): number {
  const age = Math.max(0, ageInDays);
  return REVIEW_SCORE_MAX_RECENCY * Math.exp(-age / REVIEW_SCORE_RECENCY_HALF_LIFE_DAYS);
}

export function calculateReviewScore(input: ReviewScoreInput): ReviewScoreBreakdown {
  const useful = Math.max(0, Math.trunc(input.usefulVotes));
  const notUseful = Math.max(0, Math.trunc(input.notUsefulVotes));

  const breakdown = {
    usefulnessWeight: usefulnessWeight(useful, notUseful),
    volumeWeight: volumeWeight(useful + notUseful),
    reputationWeight: reputationWeight(input.authorReputation),
    qualityWeight: qualityWeight(input),
    recencyWeight: recencyWeight(input.ageInDays),
  };

  const total =
    breakdown.usefulnessWeight +
    breakdown.volumeWeight +
    breakdown.reputationWeight +
    breakdown.qualityWeight +
    breakdown.recencyWeight;

  return {
    usefulnessWeight: roundTo(breakdown.usefulnessWeight, 4),
    volumeWeight: roundTo(breakdown.volumeWeight, 4),
    reputationWeight: roundTo(breakdown.reputationWeight, 4),
    qualityWeight: roundTo(breakdown.qualityWeight, 4),
    recencyWeight: roundTo(breakdown.recencyWeight, 4),
    total: roundTo(total, 4),
  };
}

/** Convenience wrapper for callers that only need the number. */
export function calculateReviewScoreValue(input: ReviewScoreInput): number {
  return calculateReviewScore(input).total;
}
