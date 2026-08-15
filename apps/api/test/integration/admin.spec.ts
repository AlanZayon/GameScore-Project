import request from 'supertest';

import { createTestApp, type TestContext } from '../support/test-app';
import { createGame, createPlatform, createUser } from '../support/factories';

describe('Admin moderation (integration)', () => {
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

  async function login(email: string, password = 'Str0ngPassword'): Promise<string> {
    const response = await http
      .post('/auth/login')
      .send({ identifier: email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  it('forbids a moderator from suspending an admin or another moderator', async () => {
    await createUser(context.prisma, {
      email: 'mod@example.com',
      username: 'mod',
      role: 'MODERATOR',
    });
    const admin = await createUser(context.prisma, {
      email: 'admin@example.com',
      username: 'admin',
      role: 'ADMIN',
    });
    const otherMod = await createUser(context.prisma, {
      email: 'mod2@example.com',
      username: 'mod2',
      role: 'MODERATOR',
    });
    const player = await createUser(context.prisma, {
      email: 'player@example.com',
      username: 'player',
    });

    const token = await login('mod@example.com');

    const againstAdmin = await http
      .patch(`/admin/users/${admin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED', reason: 'no' })
      .expect(403);
    expect(againstAdmin.body.code).toBe('INSUFFICIENT_ROLE');

    const againstMod = await http
      .patch(`/admin/users/${otherMod.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED', reason: 'no' })
      .expect(403);
    expect(againstMod.body.code).toBe('INSUFFICIENT_ROLE');

    await http
      .patch(`/admin/users/${player.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED', reason: 'spam' })
      .expect(200);

    const stored = await context.prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(stored.status).toBe('SUSPENDED');
  });

  it('lets an admin suspend a moderator but not another admin', async () => {
    await createUser(context.prisma, {
      email: 'admin@example.com',
      username: 'admin',
      role: 'ADMIN',
    });
    const otherAdmin = await createUser(context.prisma, {
      email: 'admin2@example.com',
      username: 'admin2',
      role: 'ADMIN',
    });
    const moderator = await createUser(context.prisma, {
      email: 'mod@example.com',
      username: 'mod',
      role: 'MODERATOR',
    });

    const token = await login('admin@example.com');

    const againstAdmin = await http
      .patch(`/admin/users/${otherAdmin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED', reason: 'no' })
      .expect(403);
    expect(againstAdmin.body.code).toBe('INSUFFICIENT_ROLE');

    await http
      .patch(`/admin/users/${moderator.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED', reason: 'policy' })
      .expect(200);
  });

  it('rejects public catalogue import without staff credentials', async () => {
    const unauthenticated = await http.post('/search/import').send({ externalId: '123' }).expect(401);
    expect(unauthenticated.body.code).toBe('UNAUTHORIZED');

    const player = await http
      .post('/auth/register')
      .send({ email: 'player@example.com', username: 'player', password: 'Str0ngPassword', acceptedTerms: true })
      .expect(201);

    const asUser = await http
      .post('/search/import')
      .set('Authorization', `Bearer ${player.body.accessToken}`)
      .send({ externalId: '123' })
      .expect(403);
    expect(asUser.body.code).toBe('INSUFFICIENT_ROLE');
  });

  it('keeps staff review removal on the audited admin route', async () => {
    const platform = await createPlatform(context.prisma);
    await createGame(context.prisma, {
      slug: 'mod-game',
      name: 'Mod Game',
      platformIds: [platform.id],
    });
    await createUser(context.prisma, {
      email: 'mod@example.com',
      username: 'mod',
      role: 'MODERATOR',
    });

    const author = await http
      .post('/auth/register')
      .send({ email: 'author@example.com', username: 'author', password: 'Str0ngPassword', acceptedTerms: true })
      .expect(201);

    const created = await http
      .post('/games/mod-game/reviews')
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .send({
        recommended: true,
        text: 'I spent forty hours with this and I would recommend it to anyone who likes this genre.',
        platformId: platform.id,
      })
      .expect(201);

    const modToken = await login('mod@example.com');
    const publicDelete = await http
      .delete(`/reviews/${created.body.id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .expect(403);
    expect(publicDelete.body.code).toBe('REVIEW_NOT_OWNED');

    await http
      .post(`/admin/reviews/${created.body.id}/remove`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ reason: 'Off-topic' })
      .expect(204);

    const hidden = await context.prisma.review.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(hidden.status).toBe('HIDDEN');
  });
});
