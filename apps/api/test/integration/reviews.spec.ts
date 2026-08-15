import request from 'supertest';

import { createTestApp, type TestContext } from '../support/test-app';
import { createGame, createPlatform } from '../support/factories';

const reviewBody = {
  recommended: true,
  text: 'I spent forty hours with this and I would recommend it to anyone who likes this genre.',
  rating: 9,
  hoursPlayed: 40,
};

describe('Reviews (integration)', () => {
  let context: TestContext;
  let http: request.Agent;
  let platformId: string;

  beforeAll(async () => {
    context = await createTestApp();
    http = request(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await context.reset();
    const platform = await createPlatform(context.prisma);
    platformId = platform.id;
    await createGame(context.prisma, {
      slug: 'test-game',
      name: 'Test Game',
      platformIds: [platformId],
    });
  });

  async function register(username: string) {
    const response = await http
      .post('/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'Str0ngPassword',
      })
      .expect(201);
    return response.body.accessToken as string;
  }

  it('creates a review, recalculates the score and refuses a second review', async () => {
    const token = await register('alice');

    const created = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...reviewBody, platformId })
      .expect(201);

    expect(created.body.recommended).toBe(true);
    expect(created.body.viewerIsAuthor).toBe(true);

    const stats = await http.get('/games/test-game/statistics').expect(200);
    expect(stats.body.score.totalReviews).toBe(1);
    expect(stats.body.score.positiveReviews).toBe(1);
    expect(stats.body.score.label).toBe('FEW_REVIEWS');

    const duplicate = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...reviewBody, platformId })
      .expect(409);
    expect(duplicate.body.code).toBe('REVIEW_ALREADY_EXISTS');
  });

  it('lets the author edit and soft-delete their review, then write a new one', async () => {
    const token = await register('alice');
    const created = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...reviewBody, platformId })
      .expect(201);

    await http
      .patch(`/reviews/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        recommended: false,
        text: 'After another week I changed my mind. The late game falls apart.',
      })
      .expect(200);

    const statsAfterEdit = await http.get('/games/test-game/statistics').expect(200);
    expect(statsAfterEdit.body.score.negativeReviews).toBe(1);

    await http
      .delete(`/reviews/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const statsAfterDelete = await http.get('/games/test-game/statistics').expect(200);
    expect(statsAfterDelete.body.score.totalReviews).toBe(0);

    await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...reviewBody, platformId })
      .expect(201);
  });

  it('rejects a spammy edit of an otherwise clean review', async () => {
    const token = await register('alice');
    const created = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...reviewBody, platformId })
      .expect(201);

    const spam = await http
      .patch(`/reviews/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa' })
      .expect(400);
    expect(spam.body.code).toBe('REVIEW_REJECTED_AS_SPAM');
  });

  it('records helpfulness votes, forbids self-voting and unique-votes a user', async () => {
    const author = await register('author');
    const voter = await register('voter');
    const created = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${author}`)
      .send({ ...reviewBody, platformId })
      .expect(201);

    const selfVote = await http
      .post(`/reviews/${created.body.id}/vote`)
      .set('Authorization', `Bearer ${author}`)
      .send({ useful: true })
      .expect(403);
    expect(selfVote.body.code).toBe('CANNOT_VOTE_OWN_REVIEW');

    const vote = await http
      .post(`/reviews/${created.body.id}/vote`)
      .set('Authorization', `Bearer ${voter}`)
      .send({ useful: true })
      .expect(200);
    expect(vote.body.usefulCount).toBe(1);
    expect(vote.body.viewerVote).toBe('USEFUL');

    await http
      .post(`/reviews/${created.body.id}/vote`)
      .set('Authorization', `Bearer ${voter}`)
      .send({ useful: false })
      .expect(200);

    const listed = await http
      .get('/games/test-game/reviews')
      .set('Authorization', `Bearer ${voter}`)
      .expect(200);
    expect(listed.body.items[0].viewerVote).toBe('NOT_USEFUL');
    expect(listed.body.items[0].notUsefulCount).toBe(1);
  });

  it('accepts a report once and rejects a second one', async () => {
    const author = await register('author');
    const reporter = await register('reporter');
    const created = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${author}`)
      .send({ ...reviewBody, platformId })
      .expect(201);

    await http
      .post(`/reviews/${created.body.id}/report`)
      .set('Authorization', `Bearer ${reporter}`)
      .send({ reason: 'SPAM', details: 'Looks copied.' })
      .expect(204);

    const again = await http
      .post(`/reviews/${created.body.id}/report`)
      .set('Authorization', `Bearer ${reporter}`)
      .send({ reason: 'SPAM' })
      .expect(409);
    expect(again.body.code).toBe('REVIEW_ALREADY_REPORTED');
  });

  it('rejects reviews that are too short', async () => {
    const token = await register('spammy');
    const response = await http
      .post('/games/test-game/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ recommended: true, text: 'good' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('paginates reviews with a cursor', async () => {
    const platform = platformId;
    for (let index = 0; index < 3; index += 1) {
      const token = await register(`writer${index}`);
      await http
        .post('/games/test-game/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...reviewBody,
          platformId: platform,
          recommended: index !== 1,
          text: `${reviewBody.text} Unique copy number ${index}.`,
        })
        .expect(201);
    }

    const first = await http.get('/games/test-game/reviews').query({ limit: 2, sort: 'RECENT' }).expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.meta.hasNextPage).toBe(true);

    const second = await http
      .get('/games/test-game/reviews')
      .query({ limit: 2, sort: 'RECENT', cursor: first.body.meta.nextCursor })
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.meta.hasNextPage).toBe(false);
  });
});
