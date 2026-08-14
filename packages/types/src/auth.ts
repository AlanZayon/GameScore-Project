import type { AuthenticatedUser } from './users';

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  /** Email or username. */
  identifier: string;
  password: string;
}

/**
 * The refresh token is delivered as an httpOnly cookie and never appears in a
 * response body, so it cannot be read by scripts running in the page.
 */
export interface AuthSessionResponse {
  accessToken: string;
  /** Access token lifetime in seconds, so the client can refresh proactively. */
  expiresIn: number;
  user: AuthenticatedUser;
}
