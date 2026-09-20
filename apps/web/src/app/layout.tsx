import { IBM_Plex_Sans, Zilla_Slab } from 'next/font/google';
import type { ReactNode } from 'react';

import { AppProviders } from '@/components/providers/app-providers';

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
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${plexSans.variable} ${zillaSlab.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas font-sans text-content antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
