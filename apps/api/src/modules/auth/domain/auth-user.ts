import type { UserRole } from '@gamescore/shared';

/** The authenticated principal attached to a request by the auth guards. */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  reputationScore: number;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  /** Identifies the stored token row, which is what makes revocation possible. */
  jti: string;
  type: 'refresh';
}

export const REFRESH_TOKEN_COOKIE = 'gs_refresh_token';
