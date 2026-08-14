/**
 * Single place where environment variables are read on the web side.
 * `NEXT_PUBLIC_*` values are inlined at build time and safe for the browser;
 * `serverEnv` must only be touched from Server Components or route handlers.
 */

export const publicEnv = {
  /** API URL used by the browser. */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  /** Public origin of this app, used for canonical and OpenGraph URLs. */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;

export const serverEnv = {
  /**
   * API URL used for server-side rendering. Inside docker compose the browser
   * and the server reach the API through different hostnames.
   */
  internalApiUrl: process.env.API_INTERNAL_URL ?? publicEnv.apiUrl,
} as const;
