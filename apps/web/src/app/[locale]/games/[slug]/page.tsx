import type { Metadata } from 'next';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { GameDetailClient } from './game-detail-client';
import { apiFetch, ApiError } from '@/lib/api';
import { resolveCoverImageUrl } from '@/lib/cover-image';
import { publicEnv } from '@/lib/env';
import { routing } from '@/i18n/routing';
import type { CursorPaginatedResponse, GameDetailDto, GameStatisticsDto, ReviewDto } from '@gamescore/types';

const loadGame = cache(async (slug: string) => {
  try {
    return await apiFetch<GameDetailDto>(`/games/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const game = await loadGame(slug);
  if (!game) return { title: 'GameScore' };

  const title = game.name;
  const description = game.summary ?? game.name;
  const canonical = locale === routing.defaultLocale ? `/games/${slug}` : `/${locale}/games/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${publicEnv.siteUrl}${canonical}`,
      languages: {
        'pt-BR': `${publicEnv.siteUrl}/games/${slug}`,
        en: `${publicEnv.siteUrl}/en/games/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${publicEnv.siteUrl}${canonical}`,
      images: (() => {
        const cover = resolveCoverImageUrl(game.name, game.coverImageUrl);
        return cover ? [{ url: cover }] : undefined;
      })(),
    },
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('game');

  const game = await loadGame(slug);
  if (!game) notFound();

  const [stats, reviews] = await Promise.all([
    apiFetch<GameStatisticsDto>(`/games/${slug}/statistics`),
    apiFetch<CursorPaginatedResponse<ReviewDto>>(`/games/${slug}/reviews?limit=20&sort=BEST`),
  ]);

  return (
    <main className="container-page space-y-8 py-8">
      <p className="sr-only">{t('title')}</p>
      <GameDetailClient initialGame={game} initialStats={stats} initialReviews={reviews} />
    </main>
  );
}
