'use client';

import type { CursorPaginatedResponse, GameDetailDto, GameStatisticsDto, ReviewDto } from '@gamescore/types';
import { REVIEW_SORTS } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ReviewCard } from '@/components/game/review-card';
import { ReviewForm } from '@/components/game/review-form';
import { ScorePanel } from '@/components/game/score-panel';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';

export function GameDetailClient({
  initialGame,
  initialStats,
  initialReviews,
}: {
  initialGame: GameDetailDto;
  initialStats: GameStatisticsDto;
  initialReviews: CursorPaginatedResponse<ReviewDto>;
}) {
  const t = useTranslations('game');
  const reviewsT = useTranslations('reviews');
  const { user, accessToken } = useAuth();
  const [game, setGame] = useState(initialGame);
  const [stats, setStats] = useState(initialStats);
  const [reviews, setReviews] = useState(initialReviews);
  const [sort, setSort] = useState('BEST');

  async function reload() {
    const [nextGame, nextStats, nextReviews] = await Promise.all([
      apiFetch<GameDetailDto>(`/games/${initialGame.slug}`, { accessToken }),
      apiFetch<GameStatisticsDto>(`/games/${initialGame.slug}/statistics`),
      apiFetch<CursorPaginatedResponse<ReviewDto>>(
        `/games/${initialGame.slug}/reviews${qs({ limit: 20, sort })}`,
        { accessToken },
      ),
    ]);
    setGame(nextGame);
    setStats(nextStats);
    setReviews(nextReviews);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex gap-5">
          <div className="h-48 w-36 shrink-0 overflow-hidden rounded-card bg-surface-raised">
            {game.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{game.name}</h1>
            <p className="text-content-muted">{game.summary}</p>
            <div className="flex flex-wrap gap-2">
              {game.platforms.map((platform) => (
                <Badge key={platform.id}>{platform.abbreviation}</Badge>
              ))}
              {game.genres.map((genre) => (
                <Badge key={genre.id} tone="brand">
                  {genre.name}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-content-subtle">
              {[game.developer, game.publisher, game.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {user && !game.viewerReviewId ? (
          <ReviewForm slug={game.slug} platforms={game.platforms} onCreated={() => void reload()} />
        ) : null}
        {!user ? (
          <p className="text-sm text-content-muted">
            <Link href="/login" className="text-brand underline">
              {reviewsT('loginToReview')}
            </Link>
          </p>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('reviews')}</h2>
            <select
              className="rounded-lg border border-border-strong bg-canvas px-3 py-1.5 text-sm"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                void apiFetch<CursorPaginatedResponse<ReviewDto>>(
                  `/games/${game.slug}/reviews${qs({ limit: 20, sort: event.target.value })}`,
                  { accessToken },
                ).then(setReviews);
              }}
            >
              {REVIEW_SORTS.map((option) => (
                <option key={option} value={option}>
                  {reviewsT(`sort.${option}`)}
                </option>
              ))}
            </select>
          </div>
          {reviews.items.length === 0 ? (
            <EmptyState title={t('noReviews')} />
          ) : (
            reviews.items.map((review) => (
              <ReviewCard key={review.id} review={review} onChanged={() => void reload()} />
            ))
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <ScorePanel score={game.score} />
        {stats.platforms.length > 0 ? (
          <div className="rounded-card border border-border-subtle bg-surface p-4">
            <h3 className="mb-3 font-semibold">{t('byPlatform')}</h3>
            <ul className="space-y-2 text-sm">
              {stats.platforms.map((row) => (
                <li key={row.platform.id} className="flex justify-between">
                  <span>{row.platform.abbreviation}</span>
                  <span>{Math.round(row.positivePercentage)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
