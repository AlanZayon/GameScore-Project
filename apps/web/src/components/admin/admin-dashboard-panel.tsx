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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={dashboard.igdbConfigured ? 'positive' : 'mixed'}>
          {dashboard.igdbConfigured ? t('igdbOn') : t('igdbOff')}
        </Badge>
      </div>

      <ul className="divide-y divide-border-subtle border-y border-border-subtle">
        {visibleCards.map(([key, value]) => {
          const tab = KPI_TO_TAB[key];
          const clickable = Boolean(tab) && (isAdmin || tab !== 'games');
          const label = t(`kpis.${key}`);
          if (!clickable || !tab) {
            return (
              <li key={key} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-sm text-content-muted">{label}</span>
                <span className="score-num text-lg font-semibold">{value}</span>
              </li>
            );
          }
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onNavigate(tab)}
                className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors duration-100 hover:bg-surface-hover"
              >
                <span className="text-sm text-content-muted">{label}</span>
                <span className="score-num text-lg font-semibold text-brand">{value}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">{t('auditTitle')}</h2>
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
