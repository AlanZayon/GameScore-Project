import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/**
 * Locale negotiation. Next 16 calls this convention `proxy` (it was previously
 * `middleware`); next-intl's handler is unchanged.
 */
export default createMiddleware(routing);

export const config = {
  // Skip Next internals, API routes, metadata icons, and any path with a file
  // extension. Without the icon exclusions, `/icon` is treated as a locale
  // route and the favicon 404s while the HTML still links to it.
  matcher: [
    '/((?!api|_next|_vercel|icon|apple-icon|favicon\\.ico|robots\\.txt|sitemap|manifest|.*\\..*).*)',
  ],
};
