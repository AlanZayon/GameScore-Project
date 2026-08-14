import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@gamescore/shared';

export const ROLES_METADATA_KEY = 'gamescore:roles';

/** Declares the minimum roles allowed to reach a handler. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_METADATA_KEY, roles);
