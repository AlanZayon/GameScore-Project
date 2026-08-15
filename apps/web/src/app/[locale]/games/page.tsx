import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogClient } from './catalog-client';
import { ErrorState } from '@/components/ui/misc';
import { apiFetch, qs } from '@/lib/api';
import type { GenreDto, PaginatedResponse, PlatformDto, GameSummaryDto } from '@gamescore/types';

export default async function GamesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; platform?: string; genre?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('catalog');
  const common = await getTranslations('common');

  let failed = false;
  let games: PaginatedResponse<GameSummaryDto> = {
    items: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false },
  };
  let platforms: PlatformDto[] = [];
  let genres: GenreDto[] = [];
  try {
    [games, platforms, genres] = await Promise.all([
      apiFetch<PaginatedResponse<GameSummaryDto>>(
        `/games${qs({
          page: query.page ?? 1,
          platform: query.platform,
          genre: query.genre,
          sort: query.sort ?? 'POPULAR',
        })}`,
      ),
      apiFetch<PlatformDto[]>('/platforms'),
      apiFetch<GenreDto[]>('/genres'),
    ]);
  } catch {
    failed = true;
  }

  return (
    <main className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-content-muted">{t('subtitle')}</p>
      </div>
      {failed ? <ErrorState title={common('errorTitle')} /> : (
        <CatalogClient games={games} platforms={platforms} genres={genres} filters={query} />
      )}
    </main>
  );
}
