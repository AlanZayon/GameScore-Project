'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await register({ email, username, password });
      router.push('/');
    } catch (caught) {
      setError(errors(caught instanceof ApiError ? caught.code : 'INTERNAL_ERROR'));
    }
  }

  return (
    <main className="container-page flex max-w-md flex-col gap-6 py-16">
      <h1 className="text-3xl font-bold">{t('registerTitle')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="username">{t('username')}</Label>
          <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className="mt-1 text-xs text-content-subtle">{t('passwordHint')}</p>
        </div>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t('registerSubmit')}
        </Button>
      </form>
    </main>
  );
}
