'use client';

import type {
  AdminDashboardDto,
  AdminUserDto,
  GameSummaryDto,
  PaginatedResponse,
  ReviewBombEventDto,
  ReviewDto,
  ReviewReportDto,
} from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { AdminBombsPanel } from '@/components/admin/admin-bombs-panel';
import { AdminDashboardPanel } from '@/components/admin/admin-dashboard-panel';
import { AdminGamesPanel } from '@/components/admin/admin-games-panel';
import { AdminImportPanel } from '@/components/admin/admin-import-panel';
import { AdminReportsPanel } from '@/components/admin/admin-reports-panel';
import { AdminReviewsPanel } from '@/components/admin/admin-reviews-panel';
import { AdminUsersPanel } from '@/components/admin/admin-users-panel';
import { useAuth } from '@/components/providers/auth-provider';
import { ErrorState, Tabs } from '@/components/ui/misc';
import { AdminPageSkeleton, ListRowsSkeleton } from '@/components/ui/skeletons';
import { apiFetch, ApiError, qs } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';

type AdminTab =
  | 'dashboard'
  | 'reviews'
  | 'reports'
  | 'bombs'
  | 'games'
  | 'users'
  | 'import';

export default function AdminPage() {
  const t = useTranslations('admin');
  const { user, accessToken, ready } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [page, setPage] = useState(1);
  const [tabLoading, setTabLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [dashboard, setDashboard] = useState<AdminDashboardDto | null>(null);
  const [reports, setReports] = useState<PaginatedResponse<ReviewReportDto> | null>(null);
  const [reportStatus, setReportStatus] = useState('PENDING');
  const [bombs, setBombs] = useState<PaginatedResponse<ReviewBombEventDto> | null>(null);
  const [bombStatus, setBombStatus] = useState('DETECTED');
  const [reviews, setReviews] = useState<PaginatedResponse<ReviewDto> | null>(null);
  const [reviewStatus, setReviewStatus] = useState('all');
  const [users, setUsers] = useState<PaginatedResponse<AdminUserDto> | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [games, setGames] = useState<PaginatedResponse<GameSummaryDto> | null>(null);
  const [gameQuery, setGameQuery] = useState('');
  const [gameSearch, setGameSearch] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role === 'USER') {
      router.replace('/');
    }
  }, [ready, user, router]);

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!accessToken || !user || user.role === 'USER') return;
    let cancelled = false;
    setTabLoading(true);
    setLoadError(false);

    async function load() {
      try {
        if (tab === 'dashboard') {
          const data = await apiFetch<AdminDashboardDto>('/admin/dashboard', { accessToken });
          if (!cancelled) setDashboard(data);
        }
        if (tab === 'reports') {
          const data = await apiFetch<PaginatedResponse<ReviewReportDto>>(
            `/admin/reports${qs({ status: reportStatus, page, limit: 20 })}`,
            { accessToken },
          );
          if (!cancelled) setReports(data);
        }
        if (tab === 'bombs') {
          const data = await apiFetch<PaginatedResponse<ReviewBombEventDto>>(
            `/admin/review-bombs${qs({
              status: bombStatus === 'all' ? undefined : bombStatus,
              page,
              limit: 20,
            })}`,
            { accessToken },
          );
          if (!cancelled) setBombs(data);
        }
        if (tab === 'reviews') {
          const data = await apiFetch<PaginatedResponse<ReviewDto>>(
            `/admin/reviews${qs({
              status: reviewStatus === 'all' ? undefined : reviewStatus,
              page,
              limit: 20,
            })}`,
            { accessToken },
          );
          if (!cancelled) setReviews(data);
        }
        if (tab === 'users') {
          const data = await apiFetch<PaginatedResponse<AdminUserDto>>(
            `/admin/users${qs({ q: userSearch || undefined, page, limit: 20 })}`,
            { accessToken },
          );
          if (!cancelled) setUsers(data);
        }
        if (tab === 'games' && isAdmin) {
          const data = await apiFetch<PaginatedResponse<GameSummaryDto>>(
            `/admin/games${qs({ q: gameSearch || undefined, page, limit: 20 })}`,
            { accessToken },
          );
          if (!cancelled) setGames(data);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(true);
          if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
            console.error(error);
          }
        }
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    accessToken,
    user,
    isAdmin,
    page,
    reportStatus,
    bombStatus,
    reviewStatus,
    userSearch,
    gameSearch,
    reloadTick,
  ]);

  if (!ready) return <AdminPageSkeleton />;
  if (!user || user.role === 'USER') return null;

  const tabs = [
    { id: 'dashboard', label: t('tabs.dashboard') },
    { id: 'reviews', label: t('tabs.reviews') },
    { id: 'reports', label: t('tabs.reports') },
    { id: 'bombs', label: t('tabs.bombs') },
    { id: 'users', label: t('tabs.users') },
    ...(isAdmin
      ? [
          { id: 'games', label: t('tabs.games') },
          { id: 'import', label: t('tabs.import') },
        ]
      : []),
  ];

  return (
    <main className="container-page space-y-5 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-sm text-content-muted">{t('subtitle')}</p>
      </div>

      <Tabs
        tabs={tabs}
        value={tab}
        onChange={(next) => {
          setTab(next as AdminTab);
          setPage(1);
          setTabLoading(true);
        }}
      />

      {loadError && !tabLoading ? (
        <ErrorState title={t('loadError')} onRetry={reload} />
      ) : null}

      {tabLoading ? <ListRowsSkeleton rows={tab === 'dashboard' ? 6 : 4} /> : null}

      {!tabLoading && !loadError && tab === 'dashboard' && dashboard ? (
        <AdminDashboardPanel
          dashboard={dashboard}
          isAdmin={isAdmin}
          onNavigate={(next) => {
            setTab(next as AdminTab);
            setPage(1);
          }}
        />
      ) : null}

      {!tabLoading && !loadError && tab === 'reports' && reports ? (
        <AdminReportsPanel
          reports={reports}
          statusFilter={reportStatus}
          onStatusFilter={(status) => {
            setReportStatus(status);
            setPage(1);
          }}
          onPage={setPage}
          onReload={async () => reload()}
          accessToken={accessToken}
        />
      ) : null}

      {!tabLoading && !loadError && tab === 'bombs' && bombs ? (
        <AdminBombsPanel
          bombs={bombs}
          statusFilter={bombStatus}
          onStatusFilter={(status) => {
            setBombStatus(status);
            setPage(1);
          }}
          onPage={setPage}
          onReload={async () => reload()}
          accessToken={accessToken}
        />
      ) : null}

      {!tabLoading && !loadError && tab === 'reviews' && reviews ? (
        <AdminReviewsPanel
          reviews={reviews}
          statusFilter={reviewStatus}
          onStatusFilter={(status) => {
            setReviewStatus(status);
            setPage(1);
          }}
          onPage={setPage}
          onReload={async () => reload()}
          accessToken={accessToken}
        />
      ) : null}

      {!tabLoading && !loadError && tab === 'users' && users ? (
        <AdminUsersPanel
          users={users}
          query={userQuery}
          onQueryChange={setUserQuery}
          onSearch={() => {
            setUserSearch(userQuery.trim());
            setPage(1);
          }}
          onPage={setPage}
          onReload={async () => reload()}
          accessToken={accessToken}
          isAdmin={isAdmin}
        />
      ) : null}

      {!tabLoading && !loadError && tab === 'games' && isAdmin && games ? (
        <AdminGamesPanel
          games={games}
          query={gameQuery}
          onQueryChange={setGameQuery}
          onSearch={() => {
            setGameSearch(gameQuery.trim());
            setPage(1);
          }}
          onPage={setPage}
          onReload={async () => reload()}
          accessToken={accessToken}
        />
      ) : null}

      {!tabLoading && tab === 'import' && isAdmin ? (
        <AdminImportPanel accessToken={accessToken} />
      ) : null}
    </main>
  );
}
