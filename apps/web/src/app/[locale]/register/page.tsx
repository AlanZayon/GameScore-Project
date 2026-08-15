'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { Link, useRouter } from '@/i18n/navigation';
import { loginPath, safeNextPath } from '@/lib/safe-next';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!acceptedTerms) {
      setError(t('termsRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({
        email,
        username,
        password,
        displayName: displayName.trim() || undefined,
        acceptedTerms: true,
      });
      router.push(next);
    } catch (caught) {
      setError(errors(caught instanceof ApiError ? caught.code : 'INTERNAL_ERROR'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-page flex max-w-md flex-col gap-6 py-16">
      <h1 className="text-3xl font-bold">{t('registerTitle')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="username">{t('username')}</Label>
          <Input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div>
          <Label htmlFor="displayName">{t('displayName')}</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="nickname"
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
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-content-subtle">{t('passwordHint')}</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-content-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
          />
          <span>
            {t('acceptTermsPrefix')}{' '}
            <Link href="/terms" className="text-brand hover:underline">
              {t('terms')}
            </Link>{' '}
            {t('acceptTermsAnd')}{' '}
            <Link href="/privacy" className="text-brand hover:underline">
              {t('privacy')}
            </Link>
            .
          </span>
        </label>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t('submitting') : t('registerSubmit')}
        </Button>
      </form>
      <p className="text-sm text-content-muted">
        {t('hasAccount')}{' '}
        <Link href={loginPath(next)} className="text-brand hover:underline">
          {t('loginSubmit')}
        </Link>
      </p>
    </main>
  );
}
