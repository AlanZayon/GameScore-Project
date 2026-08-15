'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

const STORAGE_KEY = 'gs-cookie-consent';

export function CookieBanner() {
  const t = useTranslations('cookies');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'accepted');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // Private mode can refuse storage; hiding the banner still lets people browse.
    }
    setVisible(false);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-raised px-4 py-4 shadow-lg"
      role="dialog"
      aria-label={t('title')}
    >
      <div className="container-page flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-content-muted">
          {t('body')}{' '}
          <Link href="/cookies" className="text-brand hover:underline">
            {t('policy')}
          </Link>
        </p>
        <Button type="button" size="sm" onClick={accept}>
          {t('accept')}
        </Button>
      </div>
    </div>
  );
}
