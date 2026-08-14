import { createHash, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppConfigService } from '../../../common/config/app-config.service';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { UnauthorizedError } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
} from '../domain/auth-user';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Access tokens are short lived and never stored: verifying one is a pure
   * signature check, which is what keeps authenticated reads cheap.
   */
  async signAccessToken(user: Pick<AuthUser, 'id' | 'username' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
    };

    return this.jwt.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtlSeconds,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedError(ERROR_CODES.UNAUTHORIZED, 'Wrong token type');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;

      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new UnauthorizedError(
        expired ? ERROR_CODES.ACCESS_TOKEN_EXPIRED : ERROR_CODES.UNAUTHORIZED,
        expired ? 'Access token expired' : 'Invalid access token',
      );
    }
  }

  /**
   * Refresh tokens are signed JWTs whose SHA-256 hash is stored in the
   * database. The signature makes them cheap to reject, and the stored hash
   * makes them revocable; storing only the hash means a database leak cannot be
   * replayed as a live session.
   */
  async issueRefreshToken(userId: string, userAgent?: string): Promise<IssuedRefreshToken> {
    const jti = randomUUID();
    const ttlSeconds = this.config.jwt.refreshTtlSeconds;
    const payload: RefreshTokenPayload = { sub: userId, jti, type: 'refresh' };

    const token = await this.jwt.signAsync(payload, {
      secret: this.config.jwt.refreshSecret,
      expiresIn: ttlSeconds,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validates a refresh token and replaces it with a new one (rotation).
   *
   * A token that verifies but is missing or already revoked in the database has
   * been replayed, which means it probably leaked. In that case every session
   * for the user is revoked instead of just refusing this one request.
   */
  async rotateRefreshToken(
    rawToken: string,
    userAgent?: string,
  ): Promise<{ userId: string; refreshToken: IssuedRefreshToken }> {
    const payload = await this.verifyRefreshToken(rawToken);
    const tokenHash = this.hashToken(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!stored) {
      await this.revokeAllForUser(payload.sub);
      this.logger.warn(
        `Refresh token for user ${payload.sub} was not found; all sessions revoked.`,
      );
      throw new UnauthorizedError(ERROR_CODES.INVALID_REFRESH_TOKEN, 'Refresh token is not valid');
    }

    if (stored.revokedAt !== null) {
      await this.revokeAllForUser(stored.userId);
      this.logger.warn(
        `Reuse of a revoked refresh token by user ${stored.userId}; all sessions revoked.`,
      );
      throw new UnauthorizedError(
        ERROR_CODES.INVALID_REFRESH_TOKEN,
        'Refresh token has already been used',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError(ERROR_CODES.INVALID_REFRESH_TOKEN, 'Refresh token has expired');
    }

    const refreshToken = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const jti = randomUUID();
      const ttlSeconds = this.config.jwt.refreshTtlSeconds;
      const token = await this.jwt.signAsync(
        { sub: stored.userId, jti, type: 'refresh' } satisfies RefreshTokenPayload,
        { secret: this.config.jwt.refreshSecret, expiresIn: ttlSeconds },
      );
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await tx.refreshToken.create({
        data: {
          id: jti,
          userId: stored.userId,
          tokenHash: this.hashToken(token),
          expiresAt,
          userAgent: userAgent?.slice(0, 255) ?? null,
        },
      });

      return { token, expiresAt };
    });

    return { userId: stored.userId, refreshToken };
  }

  /** Idempotent: logging out twice is not an error. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Housekeeping for the scheduled maintenance job. */
  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
      });
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError(ERROR_CODES.INVALID_REFRESH_TOKEN, 'Wrong token type');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError(ERROR_CODES.INVALID_REFRESH_TOKEN, 'Refresh token is not valid');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
