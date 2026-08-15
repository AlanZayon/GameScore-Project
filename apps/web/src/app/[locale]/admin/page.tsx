'use client';

import type { AdminDashboardDto, AdminUserDto, GameSummaryDto, PaginatedResponse, ReviewBombEventDto, ReviewDto, ReviewReportDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, EmptyState } from '@/components/ui/misc';
import { AdminPageSkeleton, ListRowsSkeleton } from '@/components/ui/skeletons';
import { apiFetch, qs } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';

export default function AdminPage() {
  const t = useTranslations('admin');
  const { user, accessToken, ready } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<AdminDashboardDto | null>(null);
  const [reports, setReports] = useState<PaginatedResponse<ReviewReportDto> | null>(null);
  const [bombs, setBombs] = useState<PaginatedResponse<ReviewBombEventDto> | null>(null);
  const [users, setUsers] = useState<PaginatedResponse<AdminUserDto> | null>(null);
  const [reviews, setReviews] = useState<PaginatedResponse<ReviewDto> | null>(null);
  const [games, setGames] = useState<PaginatedResponse<GameSummaryDto> | null>(null);
  const [importId, setImportId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role === 'USER') {
      router.replace('/');
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setTabLoading(true);

    async function load() {
      try {
        if (tab === 'dashboard') {
          const data = await apiFetch<AdminDashboardDto>('/admin/dashboard', { accessToken });
          if (!cancelled) setDashboard(data);
        }
        if (tab === 'reports') {
          const data = await apiFetch<PaginatedResponse<ReviewReportDto>>(
            `/admin/reports${qs({ status: 'PENDING' })}`,
            { accessToken },
          );
          if (!cancelled) setReports(data);
        }
        if (tab === 'bombs') {
          const data = await apiFetch<PaginatedResponse<ReviewBombEventDto>>('/admin/review-bombs', {
            accessToken,
          });
          if (!cancelled) setBombs(data);
        }
        if (tab === 'users' && user?.role === 'ADMIN') {
          const data = await apiFetch<PaginatedResponse<AdminUserDto>>('/admin/users', { accessToken });
          if (!cancelled) setUsers(data);
        }
        if (tab === 'reviews') {
          const data = await apiFetch<PaginatedResponse<ReviewDto>>('/admin/reviews', { accessToken });
          if (!cancelled) setReviews(data);
        }
        if (tab === 'games' && user?.role === 'ADMIN') {
          const data = await apiFetch<PaginatedResponse<GameSummaryDto>>('/admin/games', { accessToken });
          if (!cancelled) setGames(data);
        }
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, accessToken, user?.role]);

  if (!ready) return <AdminPageSkeleton />;
  if (!user || user.role === 'USER') return null;

  async function importGame() {
    try {
      await apiFetch('/admin/games/import', { method: 'POST', accessToken, body: { externalId: importId } });
      toast.push(t('imported'), 'success');
    } catch {
      toast.push(t('importFailed'), 'error');
    }
  }

  return (
    <main className="container-page space-y-6 py-10">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <Tabs
        tabs={[
          { id: 'dashboard', label: t('tabs.dashboard') },
          { id: 'reviews', label: t('tabs.reviews') },
          { id: 'reports', label: t('tabs.reports') },
          { id: 'bombs', label: t('tabs.bombs') },
          ...(user.role === 'ADMIN'
            ? [
                { id: 'games', label: t('tabs.games') },
                { id: 'users', label: t('tabs.users') },
                { id: 'import', label: t('tabs.import') },
              ]
            : []),
        ]}
        value={tab}
        onChange={(next) => {
          setTabLoading(true);
          setTab(next);
        }}
      />

      {tabLoading ? <ListRowsSkeleton rows={tab === 'dashboard' ? 6 : 4} /> : null}

      {!tabLoading && tab === 'dashboard' && dashboard ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(dashboard.totals).map(([key, value]) => (
            <div key={key} className="rounded-card border border-border-subtle bg-surface p-4">
              <p className="text-xs uppercase text-content-subtle">{key}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!tabLoading && tab === 'reports' && reports ? (
        reports.items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
        <ul className="space-y-3">
          {reports.items.map((report) => (
            <li key={report.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <p className="font-medium">
                {report.reason} · {report.review.author.username}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-content-muted">{report.review.text}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void apiFetch(`/admin/reports/${report.id}/resolve`, {
                      method: 'POST',
                      accessToken,
                      body: { status: 'RESOLVED', hideReview: true },
                    }).then(() => toast.push(t('resolved'), 'success'))
                  }
                >
                  {t('resolveHide')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void apiFetch(`/admin/reports/${report.id}/resolve`, {
                      method: 'POST',
                      accessToken,
                      body: { status: 'DISMISSED' },
                    }).then(() => toast.push(t('dismissed'), 'success'))
                  }
                >
                  {t('dismiss')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        )
      ) : null}

      {!tabLoading && tab === 'bombs' && bombs ? (
        bombs.items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
        <ul className="space-y-3">
          {bombs.items.map((event) => (
            <li key={event.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <p className="font-medium">
                {event.game.name} · {event.status} · {Math.round(event.severity * 100)}%
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void apiFetch(`/admin/review-bombs/${event.id}`, {
                      method: 'PATCH',
                      accessToken,
                      body: { status: 'CONFIRMED' },
                    })
                  }
                >
                  {t('confirm')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void apiFetch(`/admin/review-bombs/${event.id}`, {
                      method: 'PATCH',
                      accessToken,
                      body: { status: 'DISMISSED' },
                    })
                  }
                >
                  {t('dismiss')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        )
      ) : null}

      {!tabLoading && tab === 'reviews' && reviews ? (
        reviews.items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
        <ul className="space-y-3">
          {reviews.items.map((review) => (
            <li key={review.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <p className="font-medium">
                {review.game.name} · {review.author.username}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-content-muted">{review.text}</p>
              {review.status === 'HIDDEN' ? (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    void apiFetch(`/admin/reviews/${review.id}/restore`, {
                      method: 'POST',
                      accessToken,
                    }).then(() => toast.push(t('restored'), 'success'))
                  }
                >
                  {t('restore')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  className="mt-3"
                  onClick={() =>
                    void apiFetch(`/admin/reviews/${review.id}/remove`, {
                      method: 'POST',
                      accessToken,
                      body: { reason: 'Removed from admin queue' },
                    }).then(() => toast.push(t('removed'), 'success'))
                  }
                >
                  {t('remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>
        )
      ) : null}

      {!tabLoading && tab === 'games' && games ? (
        games.items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <ul className="space-y-3">
            {games.items.map((game) => (
              <li key={game.id} className="rounded-card border border-border-subtle bg-surface p-4">
                <p className="font-medium">{game.name}</p>
                <p className="text-sm text-content-muted">
                  {game.slug} · {game.developer ?? '—'}
                </p>
                {editingId === game.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                    <Button
                      size="sm"
                      onClick={() =>
                        void apiFetch(`/admin/games/${game.id}`, {
                          method: 'PATCH',
                          accessToken,
                          body: { name: editingName },
                        }).then(() => {
                          toast.push(t('saved'), 'success');
                          setEditingId(null);
                        })
                      }
                    >
                      {t('save')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      {t('cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="mt-3"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(game.id);
                      setEditingName(game.name);
                    }}
                  >
                    {t('edit')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!tabLoading && tab === 'users' && users ? (
        users.items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
        <ul className="space-y-3">
          {users.items.map((account) => (
            <li key={account.id} className="flex items-center justify-between rounded-card border border-border-subtle bg-surface p-4">
              <div>
                <p className="font-medium">{account.username}</p>
                <p className="text-sm text-content-muted">
                  {account.email} · {account.role} · {account.status}
                </p>
              </div>
              {account.status === 'ACTIVE' ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    void apiFetch(`/admin/users/${account.id}`, {
                      method: 'PATCH',
                      accessToken,
                      body: { status: 'SUSPENDED', reason: 'Suspended from admin' },
                    })
                  }
                >
                  {t('suspend')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    void apiFetch(`/admin/users/${account.id}`, {
                      method: 'PATCH',
                      accessToken,
                      body: { status: 'ACTIVE' },
                    })
                  }
                >
                  {t('reinstate')}
                </Button>
              )}
            </li>
          ))}
        </ul>
        )
      ) : null}

      {!tabLoading && tab === 'import' ? (
        <div className="max-w-md space-y-3">
          <p className="text-sm text-content-muted">{t('importHelp')}</p>
          <Input value={importId} onChange={(event) => setImportId(event.target.value)} placeholder="IGDB id" />
          <Button onClick={() => void importGame()}>{t('import')}</Button>
        </div>
      ) : null}
    </main>
  );
}
