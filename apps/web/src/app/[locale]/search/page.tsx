import { getTranslations, setRequestLocale } from 'next-intl/server';

import { GameCard } from '@/components/game/game-card';
import { ExternalGameCard } from '@/components/search/external-game-card';
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
        externalItems: [],
        total: 0,
        page: 1,
        limit: 24,
        totalPages: 0,
        provider: 'postgres',
        sources: ['local'],
        tookMs: 0,
      };
    }
  }

  const hasLocal = (result?.items.length ?? 0) > 0;
  const hasExternal = (result?.externalItems.length ?? 0) > 0;
  const empty = Boolean(result && !hasLocal && !hasExternal);

  return (
    <main className="container-page space-y-8 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        {query ? <p className="text-content-muted">{t('resultsFor', { query })}</p> : <p>{t('prompt')}</p>}
      </div>

      {empty ? <EmptyState title={t('empty')} /> : null}

      {hasLocal || hasExternal ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result!.items.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
          {result!.externalItems.map((hit) => (
            <ExternalGameCard key={hit.externalId} hit={hit} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
