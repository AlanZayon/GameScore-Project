'use client';

import type {
  CursorPaginatedResponse,
  GameDetailDto,
  GameRelatedItemDto,
  GameStatisticsDto,
  ReviewDto,
} from '@gamescore/types';
import { REVIEW_SORTS } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { GameCover } from '@/components/game/game-cover';
import { PlatformComparison } from '@/components/game/platform-comparison';
import { ReviewCard } from '@/components/game/review-card';
import { ReviewForm } from '@/components/game/review-form';
import { ReviewTimelineChart } from '@/components/game/review-timeline-chart';
import { ScorePanel } from '@/components/game/score-panel';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';

function relatedHref(item: GameRelatedItemDto): string {
  if (item.localSlug) return `/games/${item.localSlug}`;
  return `/games/ext/${item.externalId}`;
}

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

  const related = game.related ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <div className="flex gap-5">
          <GameCover
            name={game.name}
            src={game.coverImageUrl}
            className="h-48 w-36 shrink-0 rounded-card"
            sizes="144px"
            priority
          />
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

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('timelineTitle')}</h2>
          <ReviewTimelineChart timeline={stats.timeline} />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('platformCompareTitle')}</h2>
          <PlatformComparison platforms={stats.platforms} families={stats.families ?? []} />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('relatedTitle')}</h2>
          {related.length === 0 ? (
            <EmptyState title={t('relatedEmpty')} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={`${item.kind}:${item.externalId}`}
                  href={relatedHref(item)}
                  className="flex gap-3 rounded-card border border-border-subtle bg-surface p-3 transition hover:border-brand/40 hover:bg-surface-hover"
                >
                  <GameCover
                    name={item.name}
                    src={item.coverImageUrl}
                    className="h-20 w-14 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 space-y-1">
                    <Badge tone="brand">
                      {item.kind === 'EXPANSION' ? t('relatedExpansion') : t('relatedDlc')}
                    </Badge>
                    <p className="truncate font-medium">{item.name}</p>
                    {item.releaseDate ? (
                      <p className="text-xs text-content-subtle">{item.releaseDate.slice(0, 4)}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

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
      </aside>
    </div>
  );
}
