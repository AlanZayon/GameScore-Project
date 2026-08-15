'use client';

import type { GameSummaryDto, PaginatedResponse } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export function AdminGamesPanel({
  games,
  query,
  onQueryChange,
  onSearch,
  onPage,
  onReload,
  accessToken,
}: {
  games: PaginatedResponse<GameSummaryDto>;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onPage: (page: number) => void;
  onReload: () => void | Promise<void>;
  accessToken: string | null;
}) {
  const t = useTranslations('admin');
  const { run, isBusy } = useAdminAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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
          placeholder={t('searchGames')}
          className="max-w-sm"
        />
        <Button type="submit" size="sm" variant="secondary">
          {t('search')}
        </Button>
      </form>

      {games.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {games.items.map((game) => (
            <li key={game.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    <Link href={`/games/${game.slug}`} className="text-brand hover:underline">
                      {game.name}
                    </Link>
                  </p>
                  <p className="text-sm text-content-muted">
                    {game.slug} · {game.developer ?? '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isBusy()}
                    onClick={() =>
                      void run(
                        `sync:${game.id}`,
                        () =>
                          apiFetch(`/admin/games/${game.id}/sync`, {
                            method: 'POST',
                            accessToken,
                          }),
                        {
                          successMessage: t('synced'),
                          onSettled: onReload,
                        },
                      )
                    }
                  >
                    {t('sync')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(game.id);
                      setEditingName(game.name);
                    }}
                  >
                    {t('edit')}
                  </Button>
                </div>
              </div>

              {editingId === game.id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="max-w-md"
                  />
                  <Button
                    size="sm"
                    disabled={isBusy() || !editingName.trim()}
                    onClick={() =>
                      void run(
                        `edit:${game.id}`,
                        () =>
                          apiFetch(`/admin/games/${game.id}`, {
                            method: 'PATCH',
                            accessToken,
                            body: { name: editingName.trim() },
                          }),
                        {
                          successMessage: t('saved'),
                          onSettled: async () => {
                            setEditingId(null);
                            await onReload();
                          },
                        },
                      )
                    }
                  >
                    {t('save')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                    {t('cancel')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AdminPagination meta={games.meta} onPage={onPage} />
    </div>
  );
}
