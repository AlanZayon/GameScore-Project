'use client';

import type { AdminUserDto, PaginatedResponse } from '@gamescore/types';
import type { UserRole } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export function AdminUsersPanel({
  users,
  query,
  onQueryChange,
  onSearch,
  onPage,
  onReload,
  accessToken,
  isAdmin,
}: {
  users: PaginatedResponse<AdminUserDto>;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onPage: (page: number) => void;
  onReload: () => void | Promise<void>;
  accessToken: string | null;
  isAdmin: boolean;
}) {
  const t = useTranslations('admin');
  const { run, isBusy } = useAdminAction();
  const [suspendId, setSuspendId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('searchUsers')}
          className="max-w-sm"
        />
        <Button type="submit" size="sm" variant="secondary">
          {t('search')}
        </Button>
      </form>

      {users.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {users.items.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface p-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  <Link href={`/profile/${account.username}`} className="hover:text-brand">
                    {account.username}
                  </Link>
                </p>
                <p className="text-sm text-content-muted">{account.email}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="brand">{t(`roles.${account.role}`)}</Badge>
                  <Badge tone={account.status === 'ACTIVE' ? 'positive' : 'negative'}>
                    {t(`userStatus.${account.status}`)}
                  </Badge>
                  <span className="text-xs text-content-subtle">
                    {t('userStats', {
                      reviews: account.reviewCount,
                      reports: account.reportCount,
                    })}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isAdmin ? (
                  <select
                    className="rounded-lg border border-border-strong bg-canvas px-2 py-1.5 text-sm"
                    value={account.role}
                    disabled={isBusy()}
                    onChange={(event) => {
                      const role = event.target.value as UserRole;
                      if (role === account.role) return;
                      void run(
                        `role:${account.id}`,
                        () =>
                          apiFetch(`/admin/users/${account.id}`, {
                            method: 'PATCH',
                            accessToken,
                            body: { role },
                          }),
                        {
                          successMessage: t('roleUpdated'),
                          onSettled: onReload,
                        },
                      );
                    }}
                  >
                    <option value="USER">{t('roles.USER')}</option>
                    <option value="MODERATOR">{t('roles.MODERATOR')}</option>
                    <option value="ADMIN">{t('roles.ADMIN')}</option>
                  </select>
                ) : null}
                {account.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={isBusy()}
                    onClick={() => setSuspendId(account.id)}
                  >
                    {t('suspend')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isBusy()}
                    onClick={() =>
                      void run(
                        `reinstate:${account.id}`,
                        () =>
                          apiFetch(`/admin/users/${account.id}`, {
                            method: 'PATCH',
                            accessToken,
                            body: { status: 'ACTIVE' },
                          }),
                        {
                          successMessage: t('reinstated'),
                          onSettled: onReload,
                        },
                      )
                    }
                  >
                    {t('reinstate')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminPagination meta={users.meta} onPage={onPage} />

      <AdminConfirmDialog
        open={suspendId !== null}
        title={t('confirmSuspendTitle')}
        description={t('confirmSuspendBody')}
        confirmLabel={t('suspend')}
        danger
        busy={suspendId ? isBusy(`suspend:${suspendId}`) : false}
        onCancel={() => setSuspendId(null)}
        onConfirm={() => {
          if (!suspendId) return;
          const id = suspendId;
          void run(
            `suspend:${id}`,
            () =>
              apiFetch(`/admin/users/${id}`, {
                method: 'PATCH',
                accessToken,
                body: { status: 'SUSPENDED', reason: 'Suspended from admin' },
              }),
            {
              successMessage: t('suspended'),
              onSettled: async () => {
                setSuspendId(null);
                await onReload();
              },
            },
          );
        }}
      />
    </div>
  );
}
