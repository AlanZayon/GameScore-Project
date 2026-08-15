'use client';

import type { GameSummaryDto, GenreDto, PaginatedResponse, PlatformDto } from '@gamescore/types';
import { GAME_SORTS } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

import { GameCard } from '@/components/game/game-card';
import { EmptyState, Pagination } from '@/components/ui/misc';

export function CatalogClient({
  games,
  platforms,
  genres,
  filters,
}: {
  games: PaginatedResponse<GameSummaryDto>;
  platforms: PlatformDto[];
  genres: GenreDto[];
  filters: { platform?: string; genre?: string; sort?: string; page?: string };
}) {
  const t = useTranslations('catalog');
  const router = useRouter();

  function update(patch: Record<string, string>) {
    const next = {
      platform: filters.platform ?? '',
      genre: filters.genre ?? '',
      sort: filters.sort ?? 'POPULAR',
      page: '1',
      ...patch,
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
    }
    router.push(`/games?${search.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select
          aria-label={t('allPlatforms')}
          className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm"
          value={filters.platform ?? ''}
          onChange={(event) => update({ platform: event.target.value, page: '1' })}
        >
          <option value="">{t('allPlatforms')}</option>
          {platforms.map((platform) => (
            <option key={platform.id} value={platform.slug}>
              {platform.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('allGenres')}
          className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm"
          value={filters.genre ?? ''}
          onChange={(event) => update({ genre: event.target.value, page: '1' })}
        >
          <option value="">{t('allGenres')}</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.slug}>
              {genre.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('sort.POPULAR')}
          className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm"
          value={filters.sort ?? 'POPULAR'}
          onChange={(event) => update({ sort: event.target.value, page: '1' })}
        >
          {GAME_SORTS.filter((sort) => sort !== 'RELEVANCE').map((sort) => (
            <option key={sort} value={sort}>
              {t(`sort.${sort}`)}
            </option>
          ))}
        </select>
      </div>
      {games.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.items.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
      <Pagination
        page={games.meta.page}
        totalPages={games.meta.totalPages}
        onPage={(page) => update({ page: String(page) })}
      />
    </div>
  );
}
