import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdSlot } from '@/components/ads/ad-slot';
import { GameRow } from '@/components/game/game-card';
import { GameCover } from '@/components/game/game-cover';
import { SearchBox } from '@/components/search/search-box';
import { EmptyState, ErrorState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import type { HomeFeedDto, HomeRecentReviewDto } from '@gamescore/types';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const common = await getTranslations('common');
  const reviewsT = await getTranslations('reviews');
  let failed = false;
  let feed: HomeFeedDto = {
    popular: [],
    topRated: [],
    newReleases: [],
    trending: [],
    recentReviews: [],
    totals: { games: 0, reviews: 0, users: 0 },
  };
  try {
    feed = await apiFetch<HomeFeedDto>('/home');
  } catch {
    failed = true;
  }

  const sections = [
    { key: 'popular', games: feed.popular, href: '/rankings?tab=popular' },
    { key: 'topRated', games: feed.topRated, href: '/rankings?tab=top-rated' },
    { key: 'newReleases', games: feed.newReleases, href: '/rankings?tab=new-releases' },
    { key: 'trending', games: feed.trending, href: '/rankings?tab=trending' },
  ] as const;

  return (
    <main className="container-page space-y-8 py-6">
      <section className="space-y-3">
        <p className="max-w-2xl text-sm text-content-muted sm:text-base">{t('heroSubtitle')}</p>
        <div className="md:hidden">
          <SearchBox />
        </div>
        <p className="score-num text-xs text-content-subtle">
          {feed.totals.games} {t('statsGames')} · {feed.totals.reviews} {t('statsReviews')} · {feed.totals.users}{' '}
          {t('statsUsers')}
        </p>
      </section>

      {failed ? <ErrorState title={t('emptySection')} /> : null}

      {sections.map((section, sectionIndex) => (
        <div key={section.key} className="space-y-8">
          {sectionIndex === 1 ? <AdSlot format="horizontal" label="home-mid" /> : null}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-semibold tracking-tight">{t(section.key)}</h2>
              <Link href={section.href} className="shrink-0 text-sm font-medium text-brand hover:underline">
                {common('seeAll')}
              </Link>
            </div>
            {section.games.length === 0 ? (
              <EmptyState title={t('emptySection')} />
            ) : (
              <div className="flex flex-col border-t border-border-subtle">
                {section.games.map((game, index) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    priority={section.key === 'popular' && index === 0}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ))}

      {feed.recentReviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">{t('recentReviews')}</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {feed.recentReviews.map((review) => (
              <RecentReviewCard
                key={review.id}
                review={review}
                recommendLabel={reviewsT('recommended')}
                notLabel={reviewsT('notRecommended')}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function RecentReviewCard({
  review,
  recommendLabel,
  notLabel,
}: {
  review: HomeRecentReviewDto;
  recommendLabel: string;
  notLabel: string;
}) {
  return (
    <Link
      href={`/games/${review.gameSlug}`}
      className="flex gap-2.5 rounded-card border border-border-subtle bg-surface p-2.5 transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover"
    >
      <GameCover
        name={review.gameName}
        src={review.gameCoverImageUrl}
        className="h-16 w-12 shrink-0 rounded-sm"
        sizes="48px"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">{review.gameName}</p>
        <p className="text-xs text-content-subtle">
          @{review.authorUsername} · {review.recommended ? recommendLabel : notLabel}
        </p>
        <p className="line-clamp-2 text-sm text-content-muted">{review.excerpt}</p>
      </div>
    </Link>
  );
}
