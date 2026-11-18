import type { Metadata } from 'next';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { GameDetailClient } from './game-detail-client';
import { apiFetch, ApiError } from '@/lib/api';
import { resolveCoverImageUrl } from '@/lib/cover-image';
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  JsonLd,
  videoGameJsonLd,
} from '@/lib/seo';
import type { CursorPaginatedResponse, GameDetailDto, GameStatisticsDto, ReviewDto } from '@gamescore/types';

const loadGame = cache(async (slug: string) => {
  try {
    return await apiFetch<GameDetailDto>(`/games/${slug}`, { revalidate: false });
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
  if (!game) return { title: 'GameScore', robots: { index: false, follow: false } };

  const scorePart =
    game.score.totalReviews > 0 &&
    game.score.label !== 'FEW_REVIEWS' &&
    game.score.label !== 'NO_REVIEWS'
      ? `${Math.round(game.score.positivePercentage)}% · ${game.score.totalReviews} reviews`
      : game.score.totalReviews > 0
        ? `${game.score.totalReviews} reviews`
        : null;
  const baseDescription = game.summary ?? game.name;
  const description = scorePart ? `${baseDescription} (${scorePart})` : baseDescription;
  const cover = resolveCoverImageUrl(game.name, game.coverImageUrl);

  return buildPageMetadata({
    locale,
    path: `/games/${slug}`,
    title: game.name,
    description: description.slice(0, 300),
    images: cover ? [cover] : undefined,
  });
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('game');
  const common = await getTranslations('common');
  const nav = await getTranslations('nav');

  const game = await loadGame(slug);
  if (!game) notFound();

  const [stats, reviews] = await Promise.all([
    apiFetch<GameStatisticsDto>(`/games/${slug}/statistics`, { revalidate: false }),
    apiFetch<CursorPaginatedResponse<ReviewDto>>(`/games/${slug}/reviews?limit=20&sort=BEST`, {
      revalidate: false,
    }),
  ]);

  const cover = resolveCoverImageUrl(game.name, game.coverImageUrl);

  return (
    <main className="container-page space-y-6 py-6">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            videoGameJsonLd({
              locale,
              name: game.name,
              slug: game.slug,
              description: game.summary ?? game.description,
              image: cover,
              genres: game.genres.map((genre) => genre.name),
              releaseDate: game.releaseDate,
              positivePercentage: game.score.positivePercentage,
              totalReviews: game.score.totalReviews,
            }),
            breadcrumbJsonLd(locale, [
              { name: common('appName'), path: '/' },
              { name: nav('games'), path: '/games' },
              { name: game.name, path: `/games/${game.slug}` },
            ]),
          ],
        }}
      />
      <p className="sr-only">{t('title')}</p>
      <GameDetailClient initialGame={game} initialStats={stats} initialReviews={reviews} />
    </main>
  );
}
