import { DEFAULT_LOCALE, LOCALES } from '@gamescore/shared';
import { defineRouting } from 'next-intl/routing';

/**
 * `localePrefix: 'as-needed'` keeps the canonical Portuguese URLs clean
 * (`/games/elden-ring`) while English lives under `/en/games/elden-ring`.
 * That matters because game pages are the SEO surface of the product.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];
