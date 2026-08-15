import { getTranslations, setRequestLocale } from 'next-intl/server';

import { GameCard } from '@/components/game/game-card';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import type { HomeFeedDto } from '@gamescore/types';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
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
    // API may be down during first paint in local setup.
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
          <Link href="/games" className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-contrast hover:bg-brand-hover">
            {t('heroCta')}
          </Link>
          <Link href="/rankings" className="rounded-lg border border-border-strong px-5 py-2.5 font-medium hover:bg-surface-hover">
            {t('heroSecondaryCta')}
          </Link>
        </div>
        <p className="text-sm text-content-subtle">
          {feed.totals.games} {t('statsGames')} · {feed.totals.reviews} {t('statsReviews')} · {feed.totals.users}{' '}
          {t('statsUsers')}
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">{t(section.key)}</h2>
            <Link href={section.href} className="text-sm text-brand hover:underline">
              {t('heroCta')}
            </Link>
          </div>
          {section.games.length === 0 ? (
            <EmptyState title={t('emptySection')} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {section.games.map((game, index) => (
                <GameCard
                  key={game.id}
                  game={game}
                  priority={section.key === 'popular' && index === 0}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
