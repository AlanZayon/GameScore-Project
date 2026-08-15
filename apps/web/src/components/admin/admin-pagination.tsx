'use client';

import { useTranslations } from 'next-intl';

import { Pagination } from '@/components/ui/misc';
import type { PageMeta } from '@gamescore/types';

export function AdminPagination({
  meta,
  onPage,
}: {
  meta: PageMeta | null | undefined;
  onPage: (page: number) => void;
}) {
  const t = useTranslations('admin');
  if (!meta || meta.totalPages <= 1) {
    if (meta && meta.total > 0) {
      return (
        <p className="text-center text-xs text-content-subtle">
          {t('pagination.total', { count: meta.total })}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="space-y-2">
      <Pagination page={meta.page} totalPages={meta.totalPages} onPage={onPage} />
      <p className="text-center text-xs text-content-subtle">
        {t('pagination.total', { count: meta.total })}
      </p>
    </div>
  );
}
