import { Injectable, Logger } from '@nestjs/common';
import type { AuthSessionResponse, AuthenticatedUser } from '@gamescore/types';

import { AppConfigService } from '../../../common/config/app-config.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { toAuthenticatedUser } from '../../users/mappers/user.mapper';
import {
  UserRepository,
  type UserCredentials,
} from '../../users/repositories/user.repository';
import { PasswordHasher } from '../domain/password-hasher';
import type { AuthUser } from '../domain/auth-user';
import { TokenService, type IssuedRefreshToken } from './token.service';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface AuthResult {
  session: AuthSessionResponse;
  refreshToken: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Used to keep failed logins as slow as successful ones. See `login`. */
  private decoyHash: string | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
  ) {}

  async register(input: RegisterInput, userAgent?: string): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();

    if (await this.users.emailExists(email)) {
      throw new ConflictError(ERROR_CODES.EMAIL_ALREADY_IN_USE, 'That email is already registered');
    }
    if (await this.users.usernameExists(username)) {
      throw new ConflictError(
        ERROR_CODES.USERNAME_ALREADY_IN_USE,
        'That username is already taken',
      );
    }

    const passwordHash = await this.hasher.hash(input.password);
    const created = await this.users.create({
      email,
      username,
      passwordHash,
      displayName: input.displayName?.trim() || null,
    });

    this.logger.log(`New account registered: ${created.username}`);

    return this.buildSession(
      {
        id: created.id,
        username: created.username,
        role: created.role,
        reputationScore: created.reputationScore,
      },
      toAuthenticatedUser(created),
      userAgent,
    );
  }

  async login(input: LoginInput, userAgent?: string): Promise<AuthResult> {
    const user = await this.users.findCredentialsByIdentifier(input.identifier);

    // Verifying against a decoy hash when the account does not exist keeps the
    // response time the same either way, so the endpoint cannot be used to
    // discover which emails are registered.
    if (!user) {
      await this.hasher.verify(await this.getDecoyHash(), input.password);
      throw new UnauthorizedError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const passwordMatches = await this.hasher.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new UnauthorizedError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    await this.assertUsable(user);

    return this.buildSession(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        reputationScore: user.reputationScore,
      },
      this.toAccountResponse(user),
      userAgent,
    );
  }

  /** Rotates the refresh token and mints a new access token. */
  async refresh(rawRefreshToken: string, userAgent?: string): Promise<AuthResult> {
    const { userId, refreshToken } = await this.tokens.rotateRefreshToken(
      rawRefreshToken,
      userAgent,
    );

    const user = await this.users.findCredentialsById(userId);
    if (!user) {
      throw new UnauthorizedError(ERROR_CODES.INVALID_REFRESH_TOKEN, 'Account no longer exists');
    }
    await this.assertUsable(user);

    const accessToken = await this.tokens.signAccessToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      session: {
        accessToken,
        expiresIn: this.config.jwt.accessTtlSeconds,
        user: this.toAccountResponse(user),
      },
      refreshToken,
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  async currentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findAccountById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'Account not found');
    }
    return toAuthenticatedUser(user);
  }

  private async buildSession(
    principal: AuthUser,
    user: AuthenticatedUser,
    userAgent?: string,
  ): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken(principal),
      this.tokens.issueRefreshToken(principal.id, userAgent),
    ]);

    return {
      session: {
        accessToken,
        expiresIn: this.config.jwt.accessTtlSeconds,
        user,
      },
      refreshToken,
    };
  }

  /**
   * Rejects deleted and suspended accounts. A suspension whose end date has
   * passed is lifted here, so nothing else has to know about expiry.
   */
  private async assertUsable(user: UserCredentials): Promise<void> {
    if (user.deletedAt !== null) {
      throw new UnauthorizedError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    if (user.status !== 'SUSPENDED') return;

    const suspensionExpired =
      user.suspendedUntil !== null && user.suspendedUntil.getTime() <= Date.now();

    if (suspensionExpired) {
      await this.users.clearExpiredSuspension(user.id);
      return;
    }

    throw new ForbiddenError(
      ERROR_CODES.ACCOUNT_SUSPENDED,
      user.suspendedUntil
        ? `Account suspended until ${user.suspendedUntil.toISOString()}`
        : 'Account suspended',
    );
  }

  private toAccountResponse(user: UserCredentials): AuthenticatedUser {
    return toAuthenticatedUser({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      reputationScore: user.reputationScore,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    });
  }

  private async getDecoyHash(): Promise<string> {
    this.decoyHash ??= await this.hasher.hash('gamescore-decoy-password');
    return this.decoyHash;
  }
}
