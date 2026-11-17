import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { RankingsClient } from './rankings-client';
import { RANKING_TABS, resolveRankingTab } from './ranking-tabs';
import { apiFetch } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';
import type { RankingResponseDto } from '@gamescore/types';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'rankings' });
  const tab = resolveRankingTab(query.tab);
  const isDefaultTab = tab === 'top-rated' && (!query.tab || query.tab === 'top-rated');

  return buildPageMetadata({
    locale,
    path: '/rankings',
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: isDefaultTab ? undefined : { index: false, follow: true },
  });
}

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
    <main className="container-page space-y-5 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-content-muted">{t('subtitle')}</p>
      </div>
      <RankingsClient tab={tab} initial={data} failed={failed} />
    </main>
  );
}
