import { DEFAULT_LOCALE, type Locale } from '@gamescore/shared';
import { IBM_Plex_Sans, Zilla_Slab } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { AppProviders } from '@/components/providers/app-providers';
import { isAppLocale } from '@/lib/seo';

import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const zillaSlab = Zilla_Slab({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-zilla-slab',
  display: 'swap',
});

/**
 * Root shell. Auth/theme/query live here so they are not destroyed when
 * next-intl changes the `[locale]` segment.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const resolved = await getLocale();
    if (isAppLocale(resolved)) locale = resolved;
  } catch {
    // Metadata routes (robots/sitemap/icon) may not have a locale context.
  }

  return (
    <html lang={locale} className={`dark ${plexSans.variable} ${zillaSlab.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas font-sans text-content antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
