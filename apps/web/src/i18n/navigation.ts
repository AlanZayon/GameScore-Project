import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Always import `Link` from here rather
 * than from `next/link`, otherwise links drop the active locale.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
