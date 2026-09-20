'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { Link, useRouter } from '@/i18n/navigation';

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/reset-password', { method: 'POST', body: { token, password } });
      router.push('/login');
    } catch (caught) {
      setError(errors(caught instanceof ApiError ? caught.code : 'INTERNAL_ERROR'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-page flex max-w-md flex-col gap-5 py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('resetTitle')}</h1>
      {!token ? (
        <p className="text-sm text-negative">{errors('INVALID_RESET_TOKEN')}</p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div>
            <Label htmlFor="password">{t('newPassword')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-content-subtle">{t('passwordHint')}</p>
          </div>
          <div>
            <Label htmlFor="confirm">{t('confirmPassword')}</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('submitting') : t('resetSubmit')}
          </Button>
        </form>
      )}
      <Link href="/login" className="text-sm text-brand hover:underline">
        {t('loginSubmit')}
      </Link>
    </main>
  );
}
