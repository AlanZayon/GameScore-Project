'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');
  return (
    <main className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('errorTitle')}</h1>
      <p className="mt-2 text-content-muted">{error.message || t('errorTitle')}</p>
      <Button className="mt-6" onClick={() => reset()}>
        {t('errorRetry')}
      </Button>
    </main>
  );
}
