'use client';

import type { AccountExport, AuthenticatedUser, UserProfile } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const authT = useTranslations('auth');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const { user, accessToken, ready, applyUser, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [resending, setResending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login?next=/settings');
      return;
    }
    setDisplayName(user.displayName ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
    void apiFetch<UserProfile>(`/users/${user.username}`).then((profile) => {
      setBio(profile.bio ?? '');
    });
  }, [ready, user, router]);

  if (!ready || !user || !accessToken) return null;
  const account = user;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch<AuthenticatedUser>('/users/me', {
        method: 'PATCH',
        accessToken,
        body: {
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        },
      });
      applyUser(updated);
      toast.push(t('profileSaved'), 'success');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.push(authT('passwordMismatch'), 'error');
      return;
    }
    setChanging(true);
    try {
      await apiFetch('/auth/password', {
        method: 'POST',
        accessToken,
        body: { currentPassword, newPassword },
      });
      toast.push(authT('passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await logout();
      router.push('/login');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    } finally {
      setChanging(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: { email: account.email },
      });
      toast.push(t('verifySent'), 'success');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    } finally {
      setResending(false);
    }
  }

  async function downloadExport() {
    setExporting(true);
    try {
      const payload = await apiFetch<AccountExport>('/users/me/export', { accessToken });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gamescore-export-${account.username}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.push(t('exportReady'), 'success');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setDeleting(true);
    try {
      await apiFetch('/users/me', {
        method: 'DELETE',
        accessToken,
        body: { password: deletePassword },
      });
      toast.push(t('deleted'), 'success');
      await logout();
      router.push('/');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="container-page max-w-xl space-y-8 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-content-muted">{t('subtitle')}</p>
      </div>

      {!account.emailVerified ? (
        <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-3">
          <p className="text-sm text-content-muted">{t('verifyBanner')}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={resending} onClick={() => void resendVerification()}>
            {resending ? authT('submitting') : t('resendVerification')}
          </Button>
        </div>
      ) : null}

      <form onSubmit={(event) => void saveProfile(event)} className="space-y-4">
        <div>
          <Label htmlFor="displayName">{authT('displayName')}</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={50}
          />
          <p className="mt-1 text-xs text-content-subtle">{t('displayNameHint')}</p>
        </div>
        <div>
          <Label htmlFor="bio">{t('bio')}</Label>
          <Textarea id="bio" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} />
          <p className="mt-1 text-xs text-content-subtle">{t('bioHint')}</p>
        </div>
        <div>
          <Label htmlFor="avatarUrl">{t('avatarUrl')}</Label>
          <Input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://"
          />
          <p className="mt-1 text-xs text-content-subtle">{t('avatarHint')}</p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? authT('submitting') : common('save')}
        </Button>
      </form>

      <form onSubmit={(event) => void changePassword(event)} className="space-y-4 border-t border-border-subtle pt-8">
        <h2 className="text-xl font-semibold">{authT('changePassword')}</h2>
        <div>
          <Label htmlFor="currentPassword">{authT('currentPassword')}</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <Label htmlFor="newPassword">{authT('newPassword')}</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-content-subtle">{authT('passwordHint')}</p>
        </div>
        <div>
          <Label htmlFor="confirmPassword">{authT('confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={changing}>
          {changing ? authT('submitting') : authT('changePassword')}
        </Button>
      </form>

      <section className="space-y-4 border-t border-border-subtle pt-8">
        <h2 className="text-xl font-semibold">{t('dataTitle')}</h2>
        <p className="text-sm text-content-muted">{t('dataBody')}</p>
        <Button type="button" variant="secondary" disabled={exporting} onClick={() => void downloadExport()}>
          {exporting ? authT('submitting') : t('exportButton')}
        </Button>
      </section>

      <form
        onSubmit={(event) => void deleteAccount(event)}
        className="space-y-4 border-t border-border-subtle pt-8"
      >
        <h2 className="text-xl font-semibold text-negative">{t('deleteTitle')}</h2>
        <p className="text-sm text-content-muted">{t('deleteBody')}</p>
        <div>
          <Label htmlFor="deletePassword">{authT('currentPassword')}</Label>
          <Input
            id="deletePassword"
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" variant="danger" disabled={deleting}>
          {deleting ? authT('submitting') : t('deleteSubmit')}
        </Button>
      </form>
    </main>
  );
}
