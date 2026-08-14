import type { ReactNode } from 'react';

/**
 * Pass-through root layout. The real `<html>` / `<body>` live in `[locale]/layout`
 * so next-intl can set `lang` per request.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
