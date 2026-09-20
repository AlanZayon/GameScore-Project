import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdSlot } from '@/components/ads/ad-slot';
import { GameCard } from '@/components/game/game-card';
import { GameCover } from '@/components/game/game-cover';
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
  const scoreT = await getTranslations('score');
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
    <main className="container-page space-y-12 py-10">
      <section className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">GameScore</p>
        <h1 className="text-4xl font-bold sm:text-5xl">{t('heroTitle')}</h1>
        <p className="text-lg text-content-muted">{t('heroSubtitle')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/games"
            className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-contrast hover:bg-brand-hover"
          >
            {t('heroCta')}
          </Link>
          <Link
            href="/rankings"
            className="rounded-lg border border-border-strong px-5 py-2.5 font-medium hover:bg-surface-hover"
          >
            {t('heroSecondaryCta')}
          </Link>
          <Link href="/scoring" className="rounded-lg px-5 py-2.5 font-medium text-brand hover:underline">
            {scoreT('learnMore')}
          </Link>
        </div>
        <p className="text-sm text-content-subtle">
          {feed.totals.games} {t('statsGames')} · {feed.totals.reviews} {t('statsReviews')} · {feed.totals.users}{' '}
          {t('statsUsers')}
        </p>
      </section>

      {failed ? <ErrorState title={t('emptySection')} /> : null}

      {sections.map((section, sectionIndex) => (
        <div key={section.key} className="space-y-12">
          {sectionIndex === 1 ? <AdSlot format="horizontal" label="home-mid" /> : null}
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-semibold">{t(section.key)}</h2>
              <Link href={section.href} className="text-sm text-brand hover:underline">
                {common('seeAll')}
              </Link>
            </div>
            {section.games.length === 0 ? (
              <EmptyState title={t('emptySection')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {section.games.map((game, index) => (
                  <GameCard key={game.id} game={game} priority={section.key === 'popular' && index === 0} />
                ))}
              </div>
            )}
          </section>
        </div>
      ))}

      {feed.recentReviews.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t('recentReviews')}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {feed.recentReviews.map((review) => (
              <RecentReviewCard key={review.id} review={review} recommendLabel={reviewsT('recommended')} notLabel={reviewsT('notRecommended')} />
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
      className="flex gap-3 rounded-card border border-border-subtle bg-surface p-3 transition hover:border-brand/40 hover:bg-surface-hover"
    >
      <GameCover
        name={review.gameName}
        src={review.gameCoverImageUrl}
        className="h-20 w-14 shrink-0 rounded-md"
        sizes="56px"
      />
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium">{review.gameName}</p>
        <p className="text-xs text-content-subtle">
          @{review.authorUsername} · {review.recommended ? recommendLabel : notLabel}
        </p>
        <p className="line-clamp-2 text-sm text-content-muted">{review.excerpt}</p>
      </div>
    </Link>
  );
}
