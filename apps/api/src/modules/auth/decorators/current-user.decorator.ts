import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../domain/auth-user';

/**
 * Injects the authenticated principal. Non-null on routes protected by
 * `JwtAuthGuard`; possibly null where `OptionalJwtAuthGuard` is used.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | null => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user ?? null;
  },
);
