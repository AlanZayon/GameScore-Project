'use client';

import type { RankingResponseDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { GameRow } from '@/components/game/game-card';
import { EmptyState, ErrorState, Tabs } from '@/components/ui/misc';
import { usePathname, useRouter } from '@/i18n/navigation';

import { RANKING_TABS, type RankingTabId } from './ranking-tabs';

export function RankingsClient({
  tab,
  initial,
  failed,
}: {
  tab: RankingTabId;
  initial: RankingResponseDto | null;
  failed?: boolean;
}) {
  const t = useTranslations('rankings');
  const common = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      <Tabs
        tabs={RANKING_TABS.map((item) => ({ id: item.id, label: t(`tabs.${item.id}`) }))}
        value={tab}
        onChange={(id) => router.replace(`${pathname}?tab=${id}`)}
      />
      {initial?.minimumReviews ? (
        <p className="text-sm text-content-muted">{t('minimumReviews', { count: initial.minimumReviews })}</p>
      ) : null}
      {failed ? (
        <ErrorState title={common('errorTitle')} />
      ) : !initial || initial.entries.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ol className="flex flex-col border-t border-border-subtle">
          {initial.entries.map((entry, index) => (
            <li key={entry.game.id}>
              <GameRow game={entry.game} rank={entry.position} priority={index === 0} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
