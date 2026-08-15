'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { Link } from '@/i18n/navigation';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-page flex max-w-md flex-col gap-6 py-16">
      <h1 className="text-3xl font-bold">{t('forgotTitle')}</h1>
      <p className="text-sm text-content-muted">{t('forgotBody')}</p>
      {sent ? (
        <p className="text-sm text-content-muted">{t('forgotSent')}</p>
      ) : (
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
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('submitting') : t('forgotSubmit')}
          </Button>
        </form>
      )}
      <Link href="/login" className="text-sm text-brand hover:underline">
        {t('loginSubmit')}
      </Link>
    </main>
  );
}
