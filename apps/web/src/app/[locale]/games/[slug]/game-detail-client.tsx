'use client';

import type {
  CursorPaginatedResponse,
  GameDetailDto,
  GameRelatedItemDto,
  GameStatisticsDto,
  ReviewDto,
} from '@gamescore/types';
import { REVIEW_RECOMMENDATION_FILTERS, REVIEW_SORTS } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GameCover } from '@/components/game/game-cover';
import { PlatformComparison } from '@/components/game/platform-comparison';
import { ReviewCard } from '@/components/game/review-card';
import { ReviewForm } from '@/components/game/review-form';
import { ReviewTimelineChart } from '@/components/game/review-timeline-chart';
import { ScorePanel } from '@/components/game/score-panel';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { Link, usePathname } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';
import { isRemoteCoverUrl } from '@/lib/cover-image';
import { loginPath } from '@/lib/safe-next';

function relatedHref(item: GameRelatedItemDto): string {
  if (item.localSlug) return `/games/${item.localSlug}`;
  return `/games/ext/${item.externalId}`;
}

function relatedLabelKey(
  kind: GameRelatedItemDto['kind'],
): 'relatedDlc' | 'relatedExpansion' | 'relatedBundle' | 'relatedSimilar' {
  if (kind === 'EXPANSION') return 'relatedExpansion';
  if (kind === 'BUNDLE') return 'relatedBundle';
  if (kind === 'SIMILAR') return 'relatedSimilar';
  return 'relatedDlc';
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
  const common = useTranslations('common');
  const { user, accessToken, ready } = useAuth();
  const pathname = usePathname();
  const [game, setGame] = useState(initialGame);
  const [stats, setStats] = useState(initialStats);
  const [reviews, setReviews] = useState(initialReviews);
  const [sort, setSort] = useState('BEST');
  const [recommendation, setRecommendation] = useState('ALL');
  const [platformId, setPlatformId] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const hydrated = useRef(false);

  const reviewQuery = useCallback(
    (cursor?: string) =>
      qs({
        limit: 20,
        sort,
        recommendation: recommendation === 'ALL' ? undefined : recommendation,
        platformId: platformId || undefined,
        cursor,
      }),
    [sort, recommendation, platformId],
  );

  const reload = useCallback(async () => {
    const [nextGame, nextStats, nextReviews] = await Promise.all([
      apiFetch<GameDetailDto>(`/games/${initialGame.slug}`, { accessToken }),
      apiFetch<GameStatisticsDto>(`/games/${initialGame.slug}/statistics`),
      apiFetch<CursorPaginatedResponse<ReviewDto>>(
        `/games/${initialGame.slug}/reviews${reviewQuery()}`,
        { accessToken },
      ),
    ]);
    setGame(nextGame);
    setStats(nextStats);
    setReviews(nextReviews);
  }, [accessToken, initialGame.slug, reviewQuery]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const shouldFetch = Boolean(accessToken) || hydrated.current;
      if (shouldFetch) await reload();
      hydrated.current = true;
      if (!cancelled) setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken, reload]);

  async function loadMore() {
    if (!reviews.meta.nextCursor) return;
    setLoadingMore(true);
    try {
      const next = await apiFetch<CursorPaginatedResponse<ReviewDto>>(
        `/games/${game.slug}/reviews${reviewQuery(reviews.meta.nextCursor)}`,
        { accessToken },
      );
      setReviews({
        items: [...reviews.items, ...next.items],
        meta: next.meta,
      });
    } finally {
      setLoadingMore(false);
    }
  }

  const related = game.related ?? [];
  const banner = isRemoteCoverUrl(game.bannerImageUrl) ? game.bannerImageUrl : null;
  const longDescription = Boolean(game.description && game.description !== game.summary);
  const loginHref = loginPath(pathname);

  return (
    <div className="space-y-8">
      {banner ? (
        <div className="relative h-40 overflow-hidden rounded-card sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

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
              {longDescription ? (
                <div className="space-y-2">
                  {descriptionOpen ? (
                    <p className="whitespace-pre-wrap text-sm text-content-muted">{game.description}</p>
                  ) : null}
                  <button
                    type="button"
                    className="text-sm text-brand hover:underline"
                    onClick={() => setDescriptionOpen((value) => !value)}
                  >
                    {descriptionOpen ? t('readLess') : t('readMore')}
                  </button>
                </div>
              ) : null}
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

          {sessionReady && user && !game.viewerReviewId ? (
            <ReviewForm slug={game.slug} platforms={game.platforms} onSaved={() => void reload()} />
          ) : null}
          {sessionReady && !user ? (
            <p className="text-sm text-content-muted">
              <Link href={loginHref} className="text-brand underline">
                {reviewsT('loginToReview')}
              </Link>
            </p>
          ) : null}

          {stats.timeline.length >= 2 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('timelineTitle')}</h2>
              <ReviewTimelineChart timeline={stats.timeline} />
            </section>
          ) : null}

          {(stats.platforms.length > 0 || (stats.families?.length ?? 0) > 0) ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('platformCompareTitle')}</h2>
              <PlatformComparison platforms={stats.platforms} families={stats.families ?? []} />
            </section>
          ) : null}

          {related.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('relatedTitle')}</h2>
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
                      <Badge tone="brand">{t(relatedLabelKey(item.kind))}</Badge>
                      <p className="truncate font-medium">{item.name}</p>
                      {item.releaseDate ? (
                        <p className="text-xs text-content-subtle">{item.releaseDate.slice(0, 4)}</p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{t('reviews')}</h2>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={reviewsT('filterAll')}
                  className="rounded-lg border border-border-strong bg-canvas px-3 py-1.5 text-sm"
                  value={recommendation}
                  onChange={(event) => setRecommendation(event.target.value)}
                >
                  {REVIEW_RECOMMENDATION_FILTERS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'ALL'
                        ? reviewsT('filterAll')
                        : option === 'POSITIVE'
                          ? reviewsT('filterPositive')
                          : reviewsT('filterNegative')}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={reviewsT('platformLabel')}
                  className="rounded-lg border border-border-strong bg-canvas px-3 py-1.5 text-sm"
                  value={platformId}
                  onChange={(event) => setPlatformId(event.target.value)}
                >
                  <option value="">{reviewsT('platformNone')}</option>
                  {game.platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={reviewsT('sort.BEST')}
                  className="rounded-lg border border-border-strong bg-canvas px-3 py-1.5 text-sm"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  {REVIEW_SORTS.map((option) => (
                    <option key={option} value={option}>
                      {reviewsT(`sort.${option}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {reviews.items.length === 0 ? (
              <EmptyState title={t('noReviews')} />
            ) : (
              reviews.items.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  platforms={game.platforms}
                  onChanged={() => void reload()}
                />
              ))
            )}
            {reviews.meta.hasNextPage ? (
              <div className="flex justify-center">
                <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
                  {common('loadMore')}
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <ScorePanel
            score={game.score}
            scoreExcludingReviewBombs={stats.scoreExcludingReviewBombs}
            hasReviewBombEvents={game.hasReviewBombEvents}
          />
        </aside>
      </div>
    </div>
  );
}
