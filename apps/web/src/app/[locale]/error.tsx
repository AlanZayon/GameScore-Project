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
    <main className="container-page py-24 text-center">
      <h1 className="text-3xl font-bold">{t('errorTitle')}</h1>
      <p className="mt-2 text-content-muted">{error.message || t('errorTitle')}</p>
      <Button className="mt-6" onClick={() => reset()}>
        {t('errorRetry')}
      </Button>
    </main>
  );
}
