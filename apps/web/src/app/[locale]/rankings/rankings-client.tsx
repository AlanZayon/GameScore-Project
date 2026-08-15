'use client';

import type { RankingResponseDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { GameCard } from '@/components/game/game-card';
import { EmptyState, Tabs } from '@/components/ui/misc';
import { usePathname, useRouter } from '@/i18n/navigation';

import { RANKING_TABS, type RankingTabId } from './ranking-tabs';

export function RankingsClient({
  tab,
  initial,
}: {
  tab: RankingTabId;
  initial: RankingResponseDto | null;
}) {
  const t = useTranslations('rankings');
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      <Tabs
        tabs={RANKING_TABS.map((item) => ({ id: item.id, label: t(`tabs.${item.id}`) }))}
        value={tab}
        onChange={(id) => router.replace(`${pathname}?tab=${id}`)}
      />
      {!initial || initial.entries.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initial.entries.map((entry, index) => (
            <li key={entry.game.id} className="relative">
              <span className="absolute left-2 top-2 z-10 rounded-full bg-canvas/80 px-2 py-0.5 text-xs font-semibold">
                #{entry.position}
              </span>
              <GameCard game={entry.game} priority={index === 0} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
