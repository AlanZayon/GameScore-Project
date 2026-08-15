'use client';

import type { PaginatedResponse, ReviewReportDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminFilterChips } from '@/components/admin/admin-filter-chips';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export function AdminReportsPanel({
  reports,
  statusFilter,
  onStatusFilter,
  onPage,
  onReload,
  accessToken,
}: {
  reports: PaginatedResponse<ReviewReportDto>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onPage: (page: number) => void;
  onReload: () => void | Promise<void>;
  accessToken: string | null;
}) {
  const t = useTranslations('admin');
  const { run, isBusy } = useAdminAction();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<{
    id: string;
    mode: 'hide' | 'dismiss';
  } | null>(null);

  return (
    <div className="space-y-4">
      <AdminFilterChips
        value={statusFilter}
        onChange={onStatusFilter}
        options={[
          { id: 'PENDING', label: t('status.PENDING') },
          { id: 'RESOLVED', label: t('status.RESOLVED') },
          { id: 'DISMISSED', label: t('status.DISMISSED') },
        ]}
      />

      {reports.items.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyReports')} />
      ) : (
        <ul className="space-y-3">
          {reports.items.map((report) => {
            const open = expanded === report.id;
            return (
              <li key={report.id} className="rounded-card border border-border-subtle bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">
                        {t.has(`reasons.${report.reason}`)
                          ? t(`reasons.${report.reason}`)
                          : report.reason}
                      </Badge>
                      <Badge
                        tone={
                          report.status === 'PENDING'
                            ? 'mixed'
                            : report.status === 'RESOLVED'
                              ? 'positive'
                              : 'neutral'
                        }
                      >
                        {t(`status.${report.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      <span className="text-content-muted">{t('reportedBy')} </span>
                      <span className="font-medium">{report.reporter.username}</span>
                      <span className="text-content-muted"> · {t('reviewBy')} </span>
                      <span className="font-medium">{report.review.author.username}</span>
                    </p>
                    <p className="text-sm">
                      <Link
                        href={`/games/${report.review.game.slug}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {report.review.game.name}
                      </Link>
                      <span className="text-content-subtle">
                        {' '}
                        · {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(open ? null : report.id)}
                  >
                    {open ? t('collapse') : t('expand')}
                  </Button>
                </div>

                <p className={`mt-3 text-sm text-content-muted ${open ? '' : 'line-clamp-2'}`}>
                  {report.review.text}
                </p>
                {report.details ? (
                  <p className="mt-2 text-xs text-content-subtle">
                    {t('reportDetails')}: {report.details}
                  </p>
                ) : null}

                {report.status === 'PENDING' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={isBusy()}
                      onClick={() => {
                        setNote('');
                        setPending({ id: report.id, mode: 'hide' });
                      }}
                    >
                      {t('resolveHide')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isBusy()}
                      onClick={() => {
                        setNote('');
                        setPending({ id: report.id, mode: 'dismiss' });
                      }}
                    >
                      {t('dismiss')}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AdminPagination meta={reports.meta} onPage={onPage} />

      <AdminConfirmDialog
        open={pending !== null}
        title={pending?.mode === 'hide' ? t('confirmResolveHideTitle') : t('confirmDismissTitle')}
        description={
          <div className="space-y-3">
            <p>
              {pending?.mode === 'hide'
                ? t('confirmResolveHideBody')
                : t('confirmDismissBody')}
            </p>
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('resolutionNotePlaceholder')}
            />
          </div>
        }
        confirmLabel={pending?.mode === 'hide' ? t('resolveHide') : t('dismiss')}
        danger={pending?.mode === 'hide'}
        busy={pending ? isBusy(`report:${pending.id}`) : false}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          const { id, mode } = pending;
          void run(
            `report:${id}`,
            () =>
              apiFetch(`/admin/reports/${id}/resolve`, {
                method: 'POST',
                accessToken,
                body:
                  mode === 'hide'
                    ? { status: 'RESOLVED', hideReview: true, reason: note.trim() || undefined }
                    : { status: 'DISMISSED', reason: note.trim() || undefined },
              }),
            {
              successMessage: mode === 'hide' ? t('resolved') : t('dismissed'),
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
