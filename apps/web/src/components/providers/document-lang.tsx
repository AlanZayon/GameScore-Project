'use client';

import { useEffect } from 'react';

/** Keeps `<html lang>` in sync when the locale segment changes. */
export function DocumentLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
