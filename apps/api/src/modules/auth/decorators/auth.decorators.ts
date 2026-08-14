import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { UserRole } from '@gamescore/shared';

import { JwtAuthGuard, OptionalJwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Requires a signed-in user, and documents that in the OpenAPI spec. */
export function Authenticated(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' }),
  );
}

/** Requires a signed-in user with at least one of the given roles. */
export function RequireRoles(...roles: UserRole[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' }),
    ApiForbiddenResponse({ description: 'The account lacks the required role' }),
  );
}

/**
 * Public endpoint that returns richer data when the caller happens to be signed
 * in, for example the reviews they have already voted on.
 */
export function OptionalAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(OptionalJwtAuthGuard), ApiBearerAuth());
}
