import request from 'supertest';

import { ConsoleEmailAdapter } from '../../src/common/email/console-email.adapter';
import { REFRESH_TOKEN_COOKIE } from '../../src/modules/auth/domain/auth-user';
import { createTestApp, type TestContext } from '../support/test-app';

const validAccount = {
  email: 'Player@Example.com',
  username: 'PlayerOne',
  password: 'Str0ngPassword',
  acceptedTerms: true as const,
};

function refreshCookieFrom(response: request.Response): string {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((value) => value.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
  if (!cookie) {
    throw new Error('The response did not set a refresh cookie');
  }
  return cookie.split(';')[0]!;
}

describe('Authentication (integration)', () => {
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

  describe('POST /auth/register', () => {
    it('creates the account, normalises identifiers and starts a session', async () => {
      const response = await http.post('/auth/register').send(validAccount).expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.expiresIn).toBe(900);
      expect(response.body.user).toMatchObject({
        // Email and username are stored lowercase so uniqueness is
        // case-insensitive and profile URLs are predictable.
        email: 'player@example.com',
        username: 'playerone',
        role: 'USER',
        status: 'ACTIVE',
        reputationScore: 0,
        emailVerified: false,
        deleted: false,
      });

      // The refresh token is only ever delivered as an httpOnly cookie.
      const cookie = refreshCookieFrom(response);
      expect(cookie).toContain(REFRESH_TOKEN_COOKIE);
      const rawCookies = response.headers['set-cookie'] as unknown as string[];
      expect(rawCookies.join(';')).toContain('HttpOnly');
      expect(JSON.stringify(response.body)).not.toContain('refreshToken');
    });

    it('never exposes the password hash', async () => {
      const response = await http.post('/auth/register').send(validAccount).expect(201);
      const serialised = JSON.stringify(response.body);

      expect(serialised).not.toContain('passwordHash');
      expect(serialised).not.toContain(validAccount.password);

      const stored = await context.prisma.user.findUniqueOrThrow({
        where: { email: 'player@example.com' },
        select: { passwordHash: true },
      });
      // Argon2id, not a plain or fast hash.
      expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('rejects a duplicate email regardless of casing', async () => {
      await http.post('/auth/register').send(validAccount).expect(201);

      const response = await http
        .post('/auth/register')
        .send({ ...validAccount, email: 'PLAYER@example.com', username: 'someoneelse' })
        .expect(409);

      expect(response.body.code).toBe('EMAIL_ALREADY_IN_USE');
    });

    it('rejects a duplicate username regardless of casing', async () => {
      await http.post('/auth/register').send(validAccount).expect(201);

      const response = await http
        .post('/auth/register')
        .send({ ...validAccount, email: 'other@example.com', username: 'playerONE' })
        .expect(409);

      expect(response.body.code).toBe('USERNAME_ALREADY_IN_USE');
    });

    it('rejects weak passwords and malformed usernames', async () => {
      const weak = await http
        .post('/auth/register')
        .send({ ...validAccount, password: 'short' })
        .expect(400);
      expect(weak.body.code).toBe('VALIDATION_FAILED');
      expect(weak.body.details).toBeDefined();

      const noDigits = await http
        .post('/auth/register')
        .send({ ...validAccount, password: 'onlylettershere' })
        .expect(400);
      expect(noDigits.body.code).toBe('VALIDATION_FAILED');

      const badUsername = await http
        .post('/auth/register')
        .send({ ...validAccount, username: 'has spaces' })
        .expect(400);
      expect(badUsername.body.code).toBe('VALIDATION_FAILED');
    });

    it('strips unknown fields instead of trusting them', async () => {
      const response = await http
        .post('/auth/register')
        .send({ ...validAccount, role: 'ADMIN' })
        .expect(400);

      // Sending a field the DTO does not declare is refused outright, so a
      // client can never nominate itself as an admin.
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('rejects registration without accepting the terms', async () => {
      const { acceptedTerms: _ignored, ...withoutTerms } = validAccount;
      const response = await http.post('/auth/register').send(withoutTerms).expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await http.post('/auth/register').send(validAccount).expect(201);
    });

    it('accepts the email address', async () => {
      const response = await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: validAccount.password })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user.username).toBe('playerone');
    });

    it('accepts the username, case-insensitively', async () => {
      await http
        .post('/auth/login')
        .send({ identifier: 'PlayerOne', password: validAccount.password })
        .expect(200);
    });

    it('rejects a wrong password with the same code as an unknown account', async () => {
      const wrongPassword = await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: 'WrongPassword1' })
        .expect(401);

      const unknownAccount = await http
        .post('/auth/login')
        .send({ identifier: 'nobody@example.com', password: 'WrongPassword1' })
        .expect(401);

      // Identical responses: the endpoint must not reveal which emails exist.
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownAccount.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.message).toBe(unknownAccount.body.message);
    });

    it('refuses a suspended account', async () => {
      await context.prisma.user.update({
        where: { email: 'player@example.com' },
        data: {
          status: 'SUSPENDED',
          suspendedUntil: new Date(Date.now() + 86_400_000),
          suspensionReason: 'Testing',
        },
      });

      const response = await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: validAccount.password })
        .expect(403);

      expect(response.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('lets a user back in once the suspension has expired', async () => {
      await context.prisma.user.update({
        where: { email: 'player@example.com' },
        data: {
          status: 'SUSPENDED',
          suspendedUntil: new Date(Date.now() - 1_000),
          suspensionReason: 'Expired',
        },
      });

      await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: validAccount.password })
        .expect(200);

      const user = await context.prisma.user.findUniqueOrThrow({
        where: { email: 'player@example.com' },
        select: { status: true, suspendedUntil: true },
      });
      expect(user.status).toBe('ACTIVE');
      expect(user.suspendedUntil).toBeNull();
    });
  });

  describe('POST /auth/refresh', () => {
    let cookie: string;

    beforeEach(async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      cookie = refreshCookieFrom(registration);
    });

    it('issues a new access token and rotates the cookie', async () => {
      const response = await http.post('/auth/refresh').set('Cookie', cookie).expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      const rotated = refreshCookieFrom(response);
      expect(rotated).not.toBe(cookie);

      const tokens = await context.prisma.refreshToken.findMany({
        select: { revokedAt: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.revokedAt).not.toBeNull();
      expect(tokens[1]!.revokedAt).toBeNull();
    });

    it('revokes every session when a rotated token is replayed', async () => {
      await http.post('/auth/refresh').set('Cookie', cookie).expect(200);

      // Replaying the old cookie means it probably leaked, so all sessions die.
      const replay = await http.post('/auth/refresh').set('Cookie', cookie).expect(401);
      expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN');

      const active = await context.prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);
    });

    it('rejects a request with no cookie', async () => {
      const response = await http.post('/auth/refresh').expect(401);
      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects a forged cookie', async () => {
      const response = await http
        .post('/auth/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=not.a.real.token`)
        .expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      const cookie = refreshCookieFrom(registration);

      await http.post('/auth/logout').set('Cookie', cookie).expect(204);

      const active = await context.prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);

      await http.post('/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('is harmless without a session', async () => {
      await http.post('/auth/logout').expect(204);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the signed-in account', async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      const token = registration.body.accessToken as string;

      const response = await http
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: 'player@example.com',
        username: 'playerone',
        role: 'USER',
        emailVerified: false,
      });
    });

    it('requires a token', async () => {
      const response = await http.get('/auth/me').expect(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects a token signed with the wrong secret', async () => {
      // Token below is well-formed but signed with a different key.
      const forged =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJmYWtlIiwidXNlcm5hbWUiOiJmYWtlIiwicm9sZSI6IkFETUlOIiwidHlwZSI6ImFjY2VzcyJ9.' +
        'ZmFrZXNpZ25hdHVyZQ';

      const response = await http
        .get('/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects an access token belonging to a deleted account', async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      const token = registration.body.accessToken as string;

      await context.prisma.user.update({
        where: { email: 'player@example.com' },
        data: { deletedAt: new Date() },
      });

      // The guard checks the account on every request, so access ends
      // immediately rather than when the token happens to expire.
      await http.get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rejects an access token belonging to a suspended account', async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      const token = registration.body.accessToken as string;

      await context.prisma.user.update({
        where: { email: 'player@example.com' },
        data: { status: 'SUSPENDED', suspendedUntil: new Date(Date.now() + 86_400_000) },
      });

      const response = await http
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('password reset', () => {
    it('always returns 204 and never reveals whether the email exists', async () => {
      await http.post('/auth/register').send(validAccount).expect(201);

      await http.post('/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(204);
      await http.post('/auth/forgot-password').send({ email: 'player@example.com' }).expect(204);
    });

    it('resets the password when the emailed token is used', async () => {
      await http.post('/auth/register').send(validAccount).expect(201);
      const mailbox = context.app.get(ConsoleEmailAdapter);

      await http.post('/auth/forgot-password').send({ email: 'player@example.com' }).expect(204);
      expect(mailbox.lastMessage).toEqual(
        expect.objectContaining({
          to: 'player@example.com',
          text: expect.stringMatching(/reset-password\?token=/),
        }),
      );
      const token = /token=([a-f0-9]+)/.exec(mailbox.lastMessage?.text ?? '')?.[1];
      expect(token).toEqual(expect.any(String));

      await http
        .post('/auth/reset-password')
        .send({ token, password: 'NewPass123' })
        .expect(204);

      await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: 'Str0ngPassword' })
        .expect(401);

      await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: 'NewPass123' })
        .expect(200);
    });
  });

  describe('PATCH /users/me', () => {
    it('updates display name and bio', async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      const token = registration.body.accessToken as string;

      const response = await http
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Hero', bio: 'I play games.' })
        .expect(200);

      expect(response.body.displayName).toBe('Hero');

      const profile = await http.get('/users/playerone').expect(200);
      expect(profile.body.bio).toBe('I play games.');
    });
  });

  describe('email verification', () => {
    it('confirms the account when the emailed token is used', async () => {
      await http.post('/auth/register').send(validAccount).expect(201);
      const mailbox = context.app.get(ConsoleEmailAdapter);
      expect(mailbox.lastMessage?.text).toMatch(/verify-email\?token=/);
      const token = /token=([a-f0-9]+)/.exec(mailbox.lastMessage?.text ?? '')?.[1];
      expect(token).toEqual(expect.any(String));

      await http.post('/auth/verify-email').send({ token }).expect(204);

      const login = await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: validAccount.password })
        .expect(200);
      expect(login.body.user.emailVerified).toBe(true);
    });

    it('always returns 204 when resending verification', async () => {
      await http.post('/auth/resend-verification').send({ email: 'nobody@example.com' }).expect(204);
      await http.post('/auth/register').send(validAccount).expect(201);
      await http.post('/auth/resend-verification').send({ email: 'player@example.com' }).expect(204);
    });
  });

  describe('account export and deletion', () => {
    it('exports the signed-in account and then anonymises it', async () => {
      const registration = await http.post('/auth/register').send(validAccount).expect(201);
      const token = registration.body.accessToken as string;

      const exported = await http
        .get('/users/me/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(exported.body.account).toMatchObject({
        email: 'player@example.com',
        username: 'playerone',
        emailVerified: false,
      });
      expect(exported.body.reviews).toEqual([]);

      await http
        .delete('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: validAccount.password })
        .expect(204);

      await http.get('/users/playerone').expect(404);
      await http.get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
      await http
        .post('/auth/login')
        .send({ identifier: 'player@example.com', password: validAccount.password })
        .expect(401);
    });
  });

  describe('error contract', () => {
    it('always returns a machine readable code and a request id', async () => {
      const response = await http.get('/auth/me').expect(401);

      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      });
      expect(response.body.requestId).toEqual(expect.any(String));
      expect(response.body.stack).toBeUndefined();
    });
  });
});
