import { getTranslations, setRequestLocale } from 'next-intl/server';

import { GameRow } from '@/components/game/game-card';
import { ExternalGameCard } from '@/components/search/external-game-card';
import { SearchBox } from '@/components/search/search-box';
import { EmptyState, ErrorState } from '@/components/ui/misc';
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
  const common = await getTranslations('common');
  const query = q?.trim() ?? '';
  let failed = false;
  let result: SearchResultDto | null = null;
  if (query) {
    try {
      result = await apiFetch<SearchResultDto>(`/search${qs({ q: query, limit: 24 })}`);
    } catch {
      failed = true;
    }
  }

  const hasLocal = (result?.items.length ?? 0) > 0;
  const hasExternal = (result?.externalItems.length ?? 0) > 0;
  const empty = Boolean(result && !hasLocal && !hasExternal);

  return (
    <main className="container-page space-y-6 py-6">
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        {query ? (
          <p className="text-sm text-content-muted">{t('resultsFor', { query })}</p>
        ) : (
          <p className="text-sm text-content-muted">{t('prompt')}</p>
        )}
        <SearchBox className="max-w-xl" initialQuery={query} />
      </div>

      {failed ? <ErrorState title={common('errorTitle')} /> : null}
      {empty ? <EmptyState title={t('empty')} /> : null}

      {hasLocal ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">{t('inCatalogue')}</h2>
          <div className="flex flex-col border-t border-border-subtle">
            {result!.items.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </div>
        </section>
      ) : null}

      {hasExternal ? (
        <section className="space-y-2">
          <div>
            <h2 className="font-display text-lg font-semibold">{t('availableOnline')}</h2>
            <p className="text-sm text-content-muted">{t('availableOnlineHint')}</p>
          </div>
          <div className="flex flex-col border-t border-border-subtle">
            {result!.externalItems.map((hit) => (
              <ExternalGameCard key={hit.externalId} hit={hit} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
