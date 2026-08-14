import request from 'supertest';

import { createTestApp, type TestContext } from '../support/test-app';
import { createGame, createPlatform } from '../support/factories';

describe('Player journey (e2e)', () => {
  let context: TestContext;
  let http: request.Agent;

  beforeAll(async () => {
    context = await createTestApp();
    http = request(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await context.reset();
  });

  it('registers, logs in, opens a game, reviews it, votes and sees the score move', async () => {
    const platform = await createPlatform(context.prisma);
    await createGame(context.prisma, {
      slug: 'journey-game',
      name: 'Journey Game',
      platformIds: [platform.id],
    });

    const registration = await http
      .post('/auth/register')
      .send({ email: 'hero@example.com', username: 'hero', password: 'Str0ngPassword' })
      .expect(201);
    const accessToken = registration.body.accessToken as string;

    await http
      .post('/auth/login')
      .send({ identifier: 'hero@example.com', password: 'Str0ngPassword' })
      .expect(200);

    const game = await http.get('/games/journey-game').expect(200);
    expect(game.body.slug).toBe('journey-game');

    const review = await http
      .post('/games/journey-game/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        recommended: true,
        text: 'A complete playthrough convinced me this is worth recommending to other players.',
        rating: 9,
        hoursPlayed: 18,
        platformId: platform.id,
      })
      .expect(201);

    const voter = await http
      .post('/auth/register')
      .send({ email: 'friend@example.com', username: 'friend', password: 'Str0ngPassword' })
      .expect(201);

    await http
      .post(`/reviews/${review.body.id}/vote`)
      .set('Authorization', `Bearer ${voter.body.accessToken}`)
      .send({ useful: true })
      .expect(200);

    const stats = await http.get('/games/journey-game/statistics').expect(200);
    expect(stats.body.score.totalReviews).toBe(1);
    expect(stats.body.score.positiveReviews).toBe(1);
    expect(stats.body.score.positivePercentage).toBe(100);
    expect(stats.body.score.confidenceScore).toBeGreaterThan(0);
    expect(stats.body.score.confidenceScore).toBeLessThan(25);
    expect(stats.body.score.label).toBe('FEW_REVIEWS');

    const ranked = await http.get('/rankings/popular').expect(200);
    expect(ranked.body.entries[0].game.slug).toBe('journey-game');
  });
});
