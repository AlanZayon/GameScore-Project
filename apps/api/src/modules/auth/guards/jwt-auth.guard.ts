import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { ForbiddenError, UnauthorizedError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { UserRepository } from '../../users/repositories/user.repository';
import { TokenService } from '../application/token.service';
import type { AuthUser } from '../domain/auth-user';

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

/**
 * Verifies the access token and loads the account behind it.
 *
 * The extra lookup is deliberate: without it a suspended or deleted user would
 * keep full access until their token expired. It is a primary key read, and
 * only on authenticated requests.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  protected readonly authenticationRequired: boolean = true;

  constructor(
    protected readonly tokens: TokenService,
    protected readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request);

    if (!token) {
      if (this.authenticationRequired) {
        throw new UnauthorizedError(ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      }
      return true;
    }

    const payload = await this.resolvePayload(token);
    if (!payload) return true;

    const principal = await this.users.findAuthPrincipalById(payload.sub);
    if (!principal || principal.deletedAt !== null) {
      if (this.authenticationRequired) {
        throw new UnauthorizedError(ERROR_CODES.UNAUTHORIZED, 'Account no longer exists');
      }
      return true;
    }

    const suspended =
      principal.status === 'SUSPENDED' &&
      (principal.suspendedUntil === null || principal.suspendedUntil.getTime() > Date.now());

    if (suspended) {
      // Applies to optional routes too: a suspended account is never treated as
      // signed in, whatever the endpoint.
      throw new ForbiddenError(ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
    }

    request.user = {
      id: principal.id,
      username: principal.username,
      role: principal.role,
      reputationScore: principal.reputationScore,
    };

    return true;
  }

  private async resolvePayload(token: string) {
    if (this.authenticationRequired) {
      return this.tokens.verifyAccessToken(token);
    }

    // On optional routes a bad token means "not signed in" rather than an error,
    // so an expired token never breaks a public page.
    try {
      return await this.tokens.verifyAccessToken(token);
    } catch {
      return null;
    }
  }
}

/**
 * Attaches the user when a valid token is present, and lets anonymous requests
 * through. Used by public endpoints that return extra fields for signed-in
 * users, such as which reviews they have voted on.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  protected override readonly authenticationRequired = false;
}
