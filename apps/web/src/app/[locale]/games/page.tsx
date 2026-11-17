import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogClient } from './catalog-client';
import { ErrorState } from '@/components/ui/misc';
import { apiFetch, qs } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';
import type { GenreDto, PaginatedResponse, PlatformDto, GameSummaryDto } from '@gamescore/types';

type CatalogSearchParams = {
  page?: string;
  platform?: string;
  genre?: string;
  sort?: string;
};

function catalogHasFilters(query: CatalogSearchParams): boolean {
  const page = query.page ? Number(query.page) : 1;
  const sort = query.sort ?? 'POPULAR';
  return (
    (Number.isFinite(page) && page > 1) ||
    Boolean(query.platform) ||
    Boolean(query.genre) ||
    sort !== 'POPULAR'
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'catalog' });
  return buildPageMetadata({
    locale,
    path: '/games',
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: catalogHasFilters(query) ? { index: false, follow: true } : undefined,
  });
}

export default async function GamesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
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
    <main className="container-page space-y-5 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-content-muted">{t('subtitle')}</p>
      </div>
      {failed ? <ErrorState title={common('errorTitle')} /> : (
        <CatalogClient games={games} platforms={platforms} genres={genres} filters={query} />
      )}
    </main>
  );
}
