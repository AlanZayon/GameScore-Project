'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { Link } from '@/i18n/navigation';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError(errors('INVALID_VERIFICATION_TOKEN'));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await apiFetch('/auth/verify-email', { method: 'POST', body: { token } });
        if (!cancelled) setStatus('ok');
      } catch (caught) {
        if (cancelled) return;
        setStatus('error');
        setError(errors(caught instanceof ApiError ? caught.code : 'INTERNAL_ERROR'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, errors]);

  return (
    <main className="container-page flex max-w-md flex-col gap-6 py-16">
      <h1 className="text-3xl font-bold">{t('verifyTitle')}</h1>
      {status === 'idle' ? <p className="text-content-muted">{t('submitting')}</p> : null}
      {status === 'ok' ? <p className="text-positive">{t('verifySuccess')}</p> : null}
      {status === 'error' && error ? <p className="text-sm text-negative">{error}</p> : null}
      <Link href="/login" className="text-sm text-brand hover:underline">
        {t('loginSubmit')}
      </Link>
    </main>
  );
}
