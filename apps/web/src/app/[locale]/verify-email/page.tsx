'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const primaryBtn =
  'inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-3.5 text-sm font-medium text-brand-contrast hover:bg-brand-hover';
const secondaryBtn =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-border-strong px-3.5 text-sm font-medium hover:bg-surface-hover';
const ghostBtn =
  'inline-flex min-h-10 items-center justify-center rounded-md px-3.5 text-sm font-medium hover:bg-surface-hover';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const { user, applyUser } = useAuth();
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
        if (cancelled) return;
        setStatus('ok');
        if (user && !user.emailVerified) {
          applyUser({ ...user, emailVerified: true });
        }
      } catch (caught) {
        if (cancelled) return;
        setStatus('error');
        setError(errors(caught instanceof ApiError ? caught.code : 'INTERNAL_ERROR'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Verify once per token; don't re-run after applyUser updates session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, errors]);

  return (
    <main className="container-page flex max-w-md flex-col gap-5 py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {status === 'ok' ? t('verifyDoneTitle') : t('verifyTitle')}
      </h1>

      {status === 'idle' ? <p className="text-content-muted">{t('verifyPending')}</p> : null}

      {status === 'ok' ? (
        <>
          <p className="text-positive">{t('verifySuccess')}</p>
          <p className="text-sm text-content-muted">{t('verifySuccessHint')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {user ? (
              <Link href="/" className={primaryBtn}>
                {t('verifyContinue')}
              </Link>
            ) : (
              <>
                <Link href="/login" className={primaryBtn}>
                  {t('loginSubmit')}
                </Link>
                <Link href="/register" className={secondaryBtn}>
                  {t('registerSubmit')}
                </Link>
              </>
            )}
          </div>
        </>
      ) : null}

      {status === 'error' && error ? (
        <>
          <p className="text-sm text-negative">{error}</p>
          <p className="text-sm text-content-muted">{t('verifyErrorHint')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/settings" className={secondaryBtn}>
              {t('verifyGoSettings')}
            </Link>
            <Link href="/" className={cn(ghostBtn)}>
              {t('verifyContinue')}
            </Link>
          </div>
        </>
      ) : null}
    </main>
  );
}
