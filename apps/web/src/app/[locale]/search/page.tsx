import { getTranslations, setRequestLocale } from 'next-intl/server';

import { GameCard } from '@/components/game/game-card';
import { EmptyState } from '@/components/ui/misc';
import { apiFetch, qs } from '@/lib/api';
import type { SearchResultDto } from '@gamescore/types';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('searchPage');
  const query = q?.trim() ?? '';
  let result: SearchResultDto | null = null;
  if (query) {
    try {
      result = await apiFetch<SearchResultDto>(`/search${qs({ q: query, limit: 24 })}`);
    } catch {
      result = {
        query,
        items: [],
        total: 0,
        page: 1,
        limit: 24,
        totalPages: 0,
        provider: 'postgres',
        tookMs: 0,
      };
    }
  }

  return (
    <main className="container-page space-y-6 py-10">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      {query ? <p className="text-content-muted">{t('resultsFor', { query })}</p> : <p>{t('prompt')}</p>}
      {result && result.items.length === 0 ? <EmptyState title={t('empty')} /> : null}
      {result ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
