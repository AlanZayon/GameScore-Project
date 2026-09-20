import {
  clampReputation,
  isSensitiveReputationReason,
  reputationRankingWeightRatio,
  reputationTier,
} from '@gamescore/shared';

describe('reputationTier', () => {
  it('maps score boundaries to stable tier codes', () => {
    expect(reputationTier(0)).toBe('NEWCOMER');
    expect(reputationTier(49)).toBe('NEWCOMER');
    expect(reputationTier(50)).toBe('ACTIVE');
    expect(reputationTier(199)).toBe('ACTIVE');
    expect(reputationTier(200)).toBe('TRUSTED');
    expect(reputationTier(499)).toBe('TRUSTED');
    expect(reputationTier(500)).toBe('ESTABLISHED');
    expect(reputationTier(1499)).toBe('ESTABLISHED');
    expect(reputationTier(1500)).toBe('RESPECTED');
    expect(reputationTier(2999)).toBe('RESPECTED');
    expect(reputationTier(3000)).toBe('ELITE');
    expect(reputationTier(5000)).toBe('ELITE');
  });

  it('clamps before resolving the tier', () => {
    expect(reputationTier(-10)).toBe('NEWCOMER');
    expect(reputationTier(99999)).toBe('ELITE');
  });
});

describe('reputationRankingWeightRatio', () => {
  it('reaches full weight at the soft cap', () => {
    expect(reputationRankingWeightRatio(0)).toBe(0);
    expect(reputationRankingWeightRatio(250)).toBe(0.5);
    expect(reputationRankingWeightRatio(500)).toBe(1);
    expect(reputationRankingWeightRatio(2000)).toBe(1);
  });
});

describe('sensitive reputation reasons', () => {
  it('flags only moderation penalties', () => {
    expect(isSensitiveReputationReason('REVIEW_REMOVED_BY_MODERATOR')).toBe(true);
    expect(isSensitiveReputationReason('ABUSE_CONFIRMED')).toBe(true);
    expect(isSensitiveReputationReason('USEFUL_VOTE_RECEIVED')).toBe(false);
    expect(isSensitiveReputationReason('REVIEW_PUBLISHED')).toBe(false);
  });
});

describe('clampReputation', () => {
  it('keeps the public score inside 0..5000', () => {
    expect(clampReputation(-1)).toBe(0);
    expect(clampReputation(5001)).toBe(5000);
    expect(clampReputation(12.9)).toBe(12);
  });
});
