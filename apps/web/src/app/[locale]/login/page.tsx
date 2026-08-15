'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { Link, useRouter } from '@/i18n/navigation';
import { registerPath, safeNextPath } from '@/lib/safe-next';

export default function LoginPage() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      router.push(next);
    } catch (caught) {
      setError(errors(caught instanceof ApiError ? caught.code : 'INTERNAL_ERROR'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-page flex max-w-md flex-col gap-6 py-16">
      <h1 className="text-3xl font-bold">{t('loginTitle')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <div>
          <Label htmlFor="identifier">{t('identifier')}</Label>
          <Input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t('submitting') : t('loginSubmit')}
        </Button>
      </form>
      <div className="space-y-2 text-sm text-content-muted">
        <p>
          <Link href="/forgot-password" className="text-brand hover:underline">
            {t('forgotPassword')}
          </Link>
        </p>
        <p>
          {t('noAccount')}{' '}
          <Link href={registerPath(next)} className="text-brand hover:underline">
            {t('registerSubmit')}
          </Link>
        </p>
      </div>
    </main>
  );
}
