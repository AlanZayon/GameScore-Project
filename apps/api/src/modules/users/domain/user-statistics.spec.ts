import {
  aggregateCategoryBuckets,
  buildReputationSummary,
  buildTopUsefulReviews,
  recommendationPercentage,
  type ReviewAggInput,
} from './user-statistics';

function review(partial: Partial<ReviewAggInput> & Pick<ReviewAggInput, 'id' | 'gameId'>): ReviewAggInput {
  return {
    recommended: true,
    usefulCount: 0,
    notUsefulCount: 0,
    hoursPlayed: null,
    platformId: null,
    platformSlug: null,
    platformName: null,
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    text: 'A solid review body with enough detail.',
    gameSlug: 'demo',
    gameName: 'Demo',
    gameCoverImageUrl: null,
    genres: [],
    ...partial,
  };
}

describe('user statistics aggregations', () => {
  it('counts a multi-genre review in every genre bucket', () => {
    const reviews = [
      review({
        id: '1',
        gameId: 'g1',
        genres: [
          { slug: 'rpg', name: 'RPG' },
          { slug: 'action', name: 'Action' },
        ],
      }),
      review({
        id: '2',
        gameId: 'g2',
        genres: [{ slug: 'rpg', name: 'RPG' }],
      }),
      review({
        id: '3',
        gameId: 'g3',
        recommended: false,
        genres: [{ slug: 'rpg', name: 'RPG' }],
      }),
    ];

    const byGenre = aggregateCategoryBuckets(reviews, 'genre');
    expect(byGenre).toEqual([
      {
        key: 'rpg',
        name: 'RPG',
        reviewCount: 3,
        recommendedCount: 2,
        recommendationPercentage: recommendationPercentage(2, 3),
      },
    ]);
    expect(byGenre.find((row) => row.key === 'action')).toBeUndefined();
  });

  it('hides category buckets below the minimum sample', () => {
    const reviews = [
      review({
        id: '1',
        gameId: 'g1',
        platformSlug: 'pc',
        platformName: 'PC',
      }),
      review({
        id: '2',
        gameId: 'g2',
        platformSlug: 'pc',
        platformName: 'PC',
      }),
    ];

    expect(aggregateCategoryBuckets(reviews, 'platform')).toEqual([]);
  });

  it('puts missing platforms into the unspecified bucket when there are enough reviews', () => {
    const reviews = [1, 2, 3].map((n) =>
      review({
        id: String(n),
        gameId: `g${n}`,
        recommended: n !== 2,
      }),
    );

    expect(aggregateCategoryBuckets(reviews, 'platform')).toEqual([
      {
        key: 'unspecified',
        name: 'Unspecified',
        reviewCount: 3,
        recommendedCount: 2,
        recommendationPercentage: recommendationPercentage(2, 3),
      },
    ]);
  });

  it('skips games with no genres instead of inventing a bucket', () => {
    const reviews = [1, 2, 3].map((n) =>
      review({
        id: String(n),
        gameId: `g${n}`,
        genres: [],
      }),
    );
    expect(aggregateCategoryBuckets(reviews, 'genre')).toEqual([]);
  });

  it('builds a public reputation summary with an opaque moderation net', () => {
    const summary = buildReputationSummary(
      40,
      [
        { reason: 'REVIEW_PUBLISHED', delta: 1, balanceAfter: 1, createdAt: new Date() },
        { reason: 'USEFUL_VOTE_RECEIVED', delta: 2, balanceAfter: 3, createdAt: new Date() },
        { reason: 'ABUSE_CONFIRMED', delta: -50, balanceAfter: 0, createdAt: new Date() },
        {
          reason: 'REVIEW_REMOVED_BY_MODERATOR',
          delta: -25,
          balanceAfter: 0,
          createdAt: new Date(),
        },
      ],
      false,
    );

    expect(summary.breakdown.reviewsPublished).toBe(1);
    expect(summary.breakdown.usefulVotesReceived).toBe(1);
    expect(summary.breakdown.moderationPenalties).toBeUndefined();
    expect(summary.moderationNet).toBe(-75);
    expect(summary.tier).toBe('NEWCOMER');
  });

  it('exposes moderation penalties to staff viewers', () => {
    const summary = buildReputationSummary(
      10,
      [{ reason: 'ABUSE_CONFIRMED', delta: -50, balanceAfter: 0, createdAt: new Date() }],
      true,
    );
    expect(summary.moderationNet).toBeNull();
    expect(summary.breakdown.moderationPenalties).toBe(50);
  });

  it('returns the most useful reviews first', () => {
    const top = buildTopUsefulReviews([
      review({ id: 'a', gameId: 'g1', usefulCount: 1 }),
      review({ id: 'b', gameId: 'g2', usefulCount: 5, gameName: 'Hot' }),
      review({ id: 'c', gameId: 'g3', usefulCount: 0 }),
    ]);
    expect(top.map((item) => item.id)).toEqual(['b', 'a']);
    expect(top[0]?.gameName).toBe('Hot');
  });
});
