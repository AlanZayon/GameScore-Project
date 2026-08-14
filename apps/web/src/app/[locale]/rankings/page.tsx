'use client';

import type { RankingResponseDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { GameCard } from '@/components/game/game-card';
import { EmptyState, Skeleton, Tabs } from '@/components/ui/misc';
import { apiFetch } from '@/lib/api';

const TABS = [
  { id: 'top-rated', path: '/rankings/top-rated' },
  { id: 'trending', path: '/rankings/trending' },
  { id: 'new-releases', path: '/rankings/new-releases' },
  { id: 'popular', path: '/rankings/popular' },
];

export default function RankingsPage() {
  const t = useTranslations('rankings');
  const [tab, setTab] = useState('top-rated');
  const [data, setData] = useState<RankingResponseDto | null>(null);
  const [loadedTab, setLoadedTab] = useState<string | null>(null);

  useEffect(() => {
    const current = TABS.find((item) => item.id === tab)!;
    let cancelled = false;
    void apiFetch<RankingResponseDto>(current.path).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoadedTab(tab);
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const loading = loadedTab !== tab;

  return (
    <main className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-content-muted">{t('subtitle')}</p>
      </div>
      <Tabs
        tabs={TABS.map((item) => ({ id: item.id, label: t(`tabs.${item.id}`) }))}
        value={tab}
        onChange={setTab}
      />
      {loading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : data.entries.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.entries.map((entry) => (
            <li key={entry.game.id} className="relative">
              <span className="absolute left-2 top-2 z-10 rounded-full bg-canvas/80 px-2 py-0.5 text-xs font-semibold">
                #{entry.position}
              </span>
              <GameCard game={entry.game} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
