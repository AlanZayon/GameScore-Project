import request from 'supertest';

import { createTestApp, type TestContext } from '../support/test-app';
import { createGame, createGenre, createPlatform } from '../support/factories';

describe('Games and search (integration)', () => {
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

  it('lists games, looks them up by slug and exposes platforms/genres', async () => {
    const platform = await createPlatform(context.prisma, 'pc');
    const genre = await createGenre(context.prisma, 'rpg');
    await createGame(context.prisma, {
      slug: 'elden-ring',
      name: 'Elden Ring',
      platformIds: [platform.id],
      genreIds: [genre.id],
    });
    await createGame(context.prisma, { slug: 'hades', name: 'Hades' });

    const list = await http.get('/games').expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.items.map((item: { slug: string }) => item.slug).sort()).toEqual([
      'elden-ring',
      'hades',
    ]);

    const detail = await http.get('/games/elden-ring').expect(200);
    expect(detail.body).toMatchObject({
      slug: 'elden-ring',
      name: 'Elden Ring',
      viewerReviewId: null,
    });
    expect(detail.body.score.label).toBe('NO_REVIEWS');

    const missing = await http.get('/games/does-not-exist').expect(404);
    expect(missing.body.code).toBe('GAME_NOT_FOUND');

    const platforms = await http.get('/platforms').expect(200);
    expect(platforms.body.some((item: { slug: string }) => item.slug === 'pc')).toBe(true);

    const genres = await http.get('/genres').expect(200);
    expect(genres.body.some((item: { slug: string }) => item.slug === 'rpg')).toBe(true);
  });

  it('filters the catalogue by platform slug', async () => {
    const pc = await createPlatform(context.prisma, 'pc');
    const switchPlatform = await createPlatform(context.prisma, 'switch');
    await createGame(context.prisma, { slug: 'on-pc', name: 'On PC', platformIds: [pc.id] });
    await createGame(context.prisma, {
      slug: 'on-switch',
      name: 'On Switch',
      platformIds: [switchPlatform.id],
    });

    const response = await http.get('/games').query({ platform: 'pc' }).expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe('on-pc');
  });

  it('searches by name, slug, developer and publisher and autocompletes prefixes', async () => {
    await createGame(context.prisma, { slug: 'the-legend-of-zelda', name: 'The Legend of Zelda' });
    await context.prisma.game.create({
      data: {
        slug: 'fromsoft-soulslike',
        name: 'Shadow of the Erdtree',
        developer: 'FromSoftware',
        publisher: 'Bandai Namco',
        statistics: { create: {} },
      },
    });

    const byName = await http.get('/search').query({ q: 'zelda' }).expect(200);
    expect(byName.body.provider).toBe('postgres');
    expect(byName.body.items.some((item: { slug: string }) => item.slug === 'the-legend-of-zelda')).toBe(
      true,
    );

    const byDeveloper = await http.get('/search').query({ q: 'FromSoftware' }).expect(200);
    expect(byDeveloper.body.items.some((item: { slug: string }) => item.slug === 'fromsoft-soulslike')).toBe(
      true,
    );

    const suggestions = await http.get('/search/autocomplete').query({ q: 'zel' }).expect(200);
    expect(suggestions.body[0].slug).toBe('the-legend-of-zelda');
  });

  it('returns empty statistics for an unreviewed game', async () => {
    await createGame(context.prisma, { slug: 'new-game', name: 'New Game' });
    const stats = await http.get('/games/new-game/statistics').expect(200);
    expect(stats.body.score).toMatchObject({
      totalReviews: 0,
      positivePercentage: 0,
      confidenceScore: 0,
      label: 'NO_REVIEWS',
    });
  });

  it('attaches the viewer review id when the caller has already reviewed', async () => {
    const platform = await createPlatform(context.prisma);
    const game = await createGame(context.prisma, {
      slug: 'reviewed',
      name: 'Reviewed',
      platformIds: [platform.id],
    });
    const registration = await http
      .post('/auth/register')
      .send({ email: 'reviewer@example.com', username: 'reviewer', password: 'Str0ngPassword' })
      .expect(201);
    const token = registration.body.accessToken as string;

    await http
      .post('/games/reviewed/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recommended: true,
        text: 'A thoughtful review with enough length to pass anti-spam checks.',
        platformId: platform.id,
      })
      .expect(201);

    const detail = await http
      .get('/games/reviewed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.viewerReviewId).toEqual(expect.any(String));
    expect(game.slug).toBe('reviewed');
  });
});
