import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/**
 * Locale negotiation. Next 16 calls this convention `proxy` (it was previously
 * `middleware`); next-intl's handler is unchanged.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except Next internals, API routes and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
