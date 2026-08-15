'use client';

import type { PaginatedResponse, ReviewBombEventDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminFilterChips } from '@/components/admin/admin-filter-chips';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export function AdminBombsPanel({
  bombs,
  statusFilter,
  onStatusFilter,
  onPage,
  onReload,
  accessToken,
}: {
  bombs: PaginatedResponse<ReviewBombEventDto>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onPage: (page: number) => void;
  onReload: () => void | Promise<void>;
  accessToken: string | null;
}) {
  const t = useTranslations('admin');
  const { run, isBusy } = useAdminAction();
  const [pending, setPending] = useState<{ id: string; status: 'CONFIRMED' | 'DISMISSED' } | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <AdminFilterChips
        value={statusFilter}
        onChange={onStatusFilter}
        options={[
          { id: 'DETECTED', label: t('bombStatus.DETECTED') },
          { id: 'CONFIRMED', label: t('bombStatus.CONFIRMED') },
          { id: 'DISMISSED', label: t('bombStatus.DISMISSED') },
          { id: 'all', label: t('bombStatus.all') },
        ]}
      />

      {bombs.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {bombs.items.map((event) => (
            <li key={event.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    event.status === 'DETECTED'
                      ? 'mixed'
                      : event.status === 'CONFIRMED'
                        ? 'negative'
                        : 'neutral'
                  }
                >
                  {t(`bombStatus.${event.status}`)}
                </Badge>
                <span className="text-xs text-content-subtle">
                  {t('severity')}: {Math.round(event.severity * 100)}%
                </span>
              </div>
              <p className="mt-2 font-medium">
                <Link href={`/games/${event.game.slug}`} className="text-brand hover:underline">
                  {event.game.name}
                </Link>
              </p>
              <p className="mt-1 text-sm text-content-muted">
                {t('bombWindow', {
                  start: new Date(event.startAt).toLocaleDateString(),
                  end: new Date(event.endAt).toLocaleDateString(),
                })}
              </p>
              <p className="text-sm text-content-subtle">
                {t('bombCounts', {
                  positive: event.positiveCount,
                  negative: event.negativeCount,
                  baseline: event.baselinePerDay.toFixed(1),
                })}
              </p>
              {event.status === 'DETECTED' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isBusy()}
                    onClick={() => setPending({ id: event.id, status: 'CONFIRMED' })}
                  >
                    {t('confirm')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isBusy()}
                    onClick={() => setPending({ id: event.id, status: 'DISMISSED' })}
                  >
                    {t('dismiss')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AdminPagination meta={bombs.meta} onPage={onPage} />

      <AdminConfirmDialog
        open={pending !== null}
        title={pending?.status === 'CONFIRMED' ? t('confirmBombTitle') : t('dismissBombTitle')}
        description={
          pending?.status === 'CONFIRMED' ? t('confirmBombBody') : t('dismissBombBody')
        }
        confirmLabel={pending?.status === 'CONFIRMED' ? t('confirm') : t('dismiss')}
        danger={pending?.status === 'CONFIRMED'}
        busy={pending ? isBusy(`bomb:${pending.id}`) : false}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          const { id, status } = pending;
          void run(
            `bomb:${id}`,
            () =>
              apiFetch(`/admin/review-bombs/${id}`, {
                method: 'PATCH',
                accessToken,
                body: { status },
              }),
            {
              successMessage: status === 'CONFIRMED' ? t('bombConfirmed') : t('bombDismissed'),
              onSettled: async () => {
                setPending(null);
                await onReload();
              },
            },
          );
        }}
      />
    </div>
  );
}
