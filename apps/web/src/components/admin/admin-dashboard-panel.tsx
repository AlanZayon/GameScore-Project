'use client';

import type { AdminDashboardDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

const KPI_TO_TAB: Record<string, string> = {
  pendingReports: 'reports',
  openReviewBombEvents: 'bombs',
  hiddenReviews: 'reviews',
  suspendedUsers: 'users',
  games: 'games',
  users: 'users',
  reviews: 'reviews',
};

export function AdminDashboardPanel({
  dashboard,
  isAdmin,
  onNavigate,
}: {
  dashboard: AdminDashboardDto;
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}) {
  const t = useTranslations('admin');

  const visibleCards = (
    [
      ['pendingReports', dashboard.totals.pendingReports],
      ['openReviewBombEvents', dashboard.totals.openReviewBombEvents],
      ['hiddenReviews', dashboard.totals.hiddenReviews],
      ['reviews', dashboard.totals.reviews],
      ...(isAdmin
        ? ([
            ['games', dashboard.totals.games],
            ['users', dashboard.totals.users],
            ['suspendedUsers', dashboard.totals.suspendedUsers],
          ] as const)
        : ([['suspendedUsers', dashboard.totals.suspendedUsers]] as const)),
    ] as const
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={dashboard.igdbConfigured ? 'positive' : 'mixed'}>
          {dashboard.igdbConfigured ? t('igdbOn') : t('igdbOff')}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCards.map(([key, value]) => {
          const tab = KPI_TO_TAB[key];
          const clickable = Boolean(tab) && (isAdmin || tab !== 'games');
          const content = (
            <>
              <p className="text-xs uppercase tracking-wide text-content-subtle">{t(`kpis.${key}`)}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            </>
          );
          if (!clickable || !tab) {
            return (
              <div key={key} className="rounded-card border border-border-subtle bg-surface p-4">
                {content}
              </div>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(tab)}
              className="rounded-card border border-border-subtle bg-surface p-4 text-left transition hover:border-brand/40 hover:bg-surface-hover"
            >
              {content}
            </button>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('auditTitle')}</h2>
        {dashboard.recentAuditLogs.length === 0 ? (
          <p className="text-sm text-content-muted">{t('auditEmpty')}</p>
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface">
            {dashboard.recentAuditLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.has(`auditActions.${log.action}`)
                      ? t(`auditActions.${log.action}`)
                      : log.action}
                  </p>
                  <p className="text-xs text-content-subtle">
                    {log.actor?.username ?? '—'} · {log.targetType}/{log.targetId.slice(0, 8)}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-content-subtle">
                  {new Date(log.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
