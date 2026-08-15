import type { ReactNode } from 'react';

import { AppProviders } from '@/components/providers/app-providers';

import './globals.css';

/**
 * Root shell. Auth/theme/query live here so they are not destroyed when
 * next-intl changes the `[locale]` segment.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas text-content antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
