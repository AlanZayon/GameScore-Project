import { getTranslations, setRequestLocale } from 'next-intl/server';

import { RankingsClient } from './rankings-client';
import { RANKING_TABS, resolveRankingTab } from './ranking-tabs';
import { apiFetch } from '@/lib/api';
import type { RankingResponseDto } from '@gamescore/types';

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('rankings');
  const tab = resolveRankingTab(query.tab);
  const path = RANKING_TABS.find((item) => item.id === tab)!.path;

  let data: RankingResponseDto | null = null;
  let failed = false;
  try {
    data = await apiFetch<RankingResponseDto>(path);
  } catch {
    failed = true;
  }

  return (
    <main className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-content-muted">{t('subtitle')}</p>
      </div>
      <RankingsClient tab={tab} initial={data} failed={failed} />
    </main>
  );
}
