export const JOB_NAMES = {
  RECALCULATE_GAME_SCORE: 'ratings.recalculate-game',
  DETECT_REVIEW_BOMB: 'reviews.detect-bomb',
  RECORD_GAME_VIEW: 'games.record-view',
  SNAPSHOT_SCORES: 'ratings.snapshot-scores',
  MAINTENANCE: 'system.maintenance',
  INVALIDATE_RANKINGS: 'rankings.invalidate',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface RecalculateGameScorePayload {
  gameId: string;
}

export interface DetectReviewBombPayload {
  gameId: string;
  date: string;
}

export interface RecordGameViewPayload {
  gameId: string;
}
