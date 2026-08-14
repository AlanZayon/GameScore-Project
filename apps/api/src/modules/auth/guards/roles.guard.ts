import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@gamescore/shared';
import type { Request } from 'express';

import { ForbiddenError, UnauthorizedError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import type { AuthUser } from '../domain/auth-user';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';

/**
 * Roles are hierarchical: an admin satisfies a moderator requirement without
 * every endpoint having to list both.
 */
const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedError(ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    }

    const minimumRank = Math.min(...required.map((role) => ROLE_RANK[role]));
    const userRank = ROLE_RANK[user.role as UserRole] ?? 0;
    if (userRank < minimumRank) {
      throw new ForbiddenError(
        ERROR_CODES.INSUFFICIENT_ROLE,
        `This action requires the ${required.join(' or ')} role`,
      );
    }

    return true;
  }
}
