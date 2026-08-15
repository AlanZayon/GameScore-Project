'use client';

import type { PaginatedResponse, ReviewDto } from '@gamescore/types';
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

export function AdminReviewsPanel({
  reviews,
  statusFilter,
  onStatusFilter,
  onPage,
  onReload,
  accessToken,
}: {
  reviews: PaginatedResponse<ReviewDto>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onPage: (page: number) => void;
  onReload: () => void | Promise<void>;
  accessToken: string | null;
}) {
  const t = useTranslations('admin');
  const { run, isBusy } = useAdminAction();
  const [removeId, setRemoveId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <AdminFilterChips
        value={statusFilter}
        onChange={onStatusFilter}
        options={[
          { id: 'all', label: t('reviewFilters.all') },
          { id: 'hidden', label: t('reviewFilters.hidden') },
        ]}
      />

      {reviews.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {reviews.items.map((review) => (
            <li key={review.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={review.status === 'HIDDEN' ? 'negative' : 'positive'}>
                  {t(`reviewStatus.${review.status}`)}
                </Badge>
                <Badge tone="neutral">
                  {t.has(`moderation.${review.moderationStatus}`)
                    ? t(`moderation.${review.moderationStatus}`)
                    : review.moderationStatus}
                </Badge>
              </div>
              <p className="mt-2 font-medium">
                <Link href={`/games/${review.game.slug}`} className="text-brand hover:underline">
                  {review.game.name}
                </Link>
                <span className="text-content-muted"> · {review.author.username}</span>
              </p>
              <p className="mt-1 line-clamp-3 text-sm text-content-muted">{review.text}</p>
              <div className="mt-3">
                {review.status === 'HIDDEN' ? (
                  <Button
                    size="sm"
                    disabled={isBusy()}
                    onClick={() =>
                      void run(
                        `restore:${review.id}`,
                        () =>
                          apiFetch(`/admin/reviews/${review.id}/restore`, {
                            method: 'POST',
                            accessToken,
                          }),
                        {
                          successMessage: t('restored'),
                          onSettled: onReload,
                        },
                      )
                    }
                  >
                    {t('restore')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={isBusy()}
                    onClick={() => setRemoveId(review.id)}
                  >
                    {t('remove')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminPagination meta={reviews.meta} onPage={onPage} />

      <AdminConfirmDialog
        open={removeId !== null}
        title={t('confirmRemoveTitle')}
        description={t('confirmRemoveBody')}
        confirmLabel={t('remove')}
        danger
        busy={removeId ? isBusy(`remove:${removeId}`) : false}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          if (!removeId) return;
          const id = removeId;
          void run(
            `remove:${id}`,
            () =>
              apiFetch(`/admin/reviews/${id}/remove`, {
                method: 'POST',
                accessToken,
                body: { reason: 'Removed from admin queue' },
              }),
            {
              successMessage: t('removed'),
              onSettled: async () => {
                setRemoveId(null);
                await onReload();
              },
            },
          );
        }}
      />
    </div>
  );
}
