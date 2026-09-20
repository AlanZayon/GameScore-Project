'use client';

import type {
  CursorPaginatedResponse,
  ReputationEventDto,
  ReviewDto,
  UserProfile,
  UserStatisticsDto,
  UserStatisticsRange,
} from '@gamescore/types';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProfileEditLink } from '@/components/profile/profile-edit-link';
import { ProfileReviews } from '@/components/profile/profile-reviews';
import { useAuth } from '@/components/providers/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, Tabs } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';

type TabId = 'overview' | 'statistics' | 'reviews' | 'reputation';

export function ProfilePageClient({
  profile,
  initialReviews,
  initialStatistics,
}: {
  profile: UserProfile;
  initialReviews: CursorPaginatedResponse<ReviewDto>;
  initialStatistics: UserStatisticsDto;
}) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');
  const [range, setRange] = useState<UserStatisticsRange>(initialStatistics.range);
  const [stats, setStats] = useState(initialStatistics);
  const [statsLoading, setStatsLoading] = useState(false);
  const [events, setEvents] = useState<CursorPaginatedResponse<ReputationEventDto> | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: t('tabs.overview') },
      { id: 'statistics', label: t('tabs.statistics') },
      { id: 'reviews', label: t('tabs.reviews') },
      { id: 'reputation', label: t('tabs.reputation') },
    ],
    [t],
  );

  const loadStats = useCallback(
    async (nextRange: UserStatisticsRange) => {
      setStatsLoading(true);
      try {
        const next = await apiFetch<UserStatisticsDto>(
          `/users/${profile.username}/statistics${qs({ range: nextRange })}`,
          { accessToken },
        );
        setStats(next);
        setRange(nextRange);
      } finally {
        setStatsLoading(false);
      }
    },
    [accessToken, profile.username],
  );

  const loadEvents = useCallback(
    async (cursor?: string) => {
      setEventsLoading(true);
      try {
        const next = await apiFetch<CursorPaginatedResponse<ReputationEventDto>>(
          `/users/${profile.username}/reputation-events${qs({ limit: 20, cursor })}`,
          { accessToken },
        );
        setEvents((prev) =>
          cursor && prev
            ? { items: [...prev.items, ...next.items], meta: next.meta }
            : next,
        );
      } finally {
        setEventsLoading(false);
      }
    },
    [accessToken, profile.username],
  );

  useEffect(() => {
    if (tab === 'reputation' && events === null) {
      void loadEvents();
    }
  }, [tab, events, loadEvents]);

  return (
    <main className="container-page space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile.displayName || profile.username} src={profile.avatarUrl} size="lg" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{profile.displayName || profile.username}</h1>
            <p className="text-sm text-content-muted">@{profile.username}</p>
            {profile.bio ? <p className="mt-2 max-w-xl text-sm text-content-muted">{profile.bio}</p> : null}
            <p className="mt-2 text-sm text-content-subtle">
              {t('memberSince', {
                date: new Date(profile.createdAt).toLocaleDateString(locale),
              })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs font-medium text-content">
                {t(`tiers.${stats.reputation.tier}`)}
              </span>
              <ProfileEditLink username={profile.username} label={t('editProfile')} />
            </div>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-y border-border-subtle py-3 sm:grid-cols-3">
        <Stat label={t('reviews')} value={profile.stats.totalReviews} />
        <Stat label={t('reputation')} value={profile.reputationScore} />
        <Stat label={t('useful')} value={profile.stats.usefulVotesReceived} />
        <Stat
          label={t('recommendationRate')}
          value={`${Math.round(profile.stats.recommendationPercentage)}%`}
        />
        <Stat label={t('hoursPlayed')} value={profile.stats.totalHoursPlayed} />
        <Stat label={t('gamesReviewed')} value={profile.stats.gamesReviewed} />
      </dl>

      <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'overview' ? <OverviewTab stats={stats} t={t} /> : null}

      {tab === 'statistics' ? (
        <StatisticsTab
          stats={stats}
          range={range}
          loading={statsLoading}
          onRangeChange={(next) => void loadStats(next)}
          t={t}
        />
      ) : null}

      {tab === 'reviews' ? (
        <ProfileReviews username={profile.username} initial={initialReviews} />
      ) : null}

      {tab === 'reputation' ? (
        <ReputationTab
          stats={stats}
          events={events}
          loading={eventsLoading}
          onLoadMore={() => {
            if (events?.meta.nextCursor) void loadEvents(events.meta.nextCursor);
          }}
          t={t}
          locale={locale}
        />
      ) : null}
    </main>
  );
}

function OverviewTab({
  stats,
  t,
}: {
  stats: UserStatisticsDto;
  t: ReturnType<typeof useTranslations<'profile'>>;
}) {
  if (!stats.analyticsAvailable) {
    return <EmptyState title={t('analyticsEmpty')} description={t('analyticsEmptyHint')} />;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('usefulRate')}
          value={stats.usefulRate === null ? '—' : `${Math.round(stats.usefulRate)}%`}
        />
        <Stat
          label={t('vsCommunity')}
          value={`${Math.round(stats.recommendationPercentage)}% / ${Math.round(stats.siteRecommendationPercentage)}%`}
        />
        <Stat label={t('tier')} value={t(`tiers.${stats.reputation.tier}`)} />
        <Stat
          label={t('rankingWeight')}
          value={`${Math.round(stats.reputation.rankingWeightRatio * 100)}%`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('topUseful')}</h2>
        {stats.topUsefulReviews.length === 0 ? (
          <EmptyState title={t('topUsefulEmpty')} />
        ) : (
          <ul className="space-y-3">
            {stats.topUsefulReviews.map((review) => (
              <li
                key={review.id}
                className="rounded-card border border-border-subtle bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/games/${review.gameSlug}`}
                    className="font-medium hover:underline"
                  >
                    {review.gameName}
                  </Link>
                  <span className="text-xs text-content-subtle">
                    {t('usefulCount', { count: review.usefulCount })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-content-muted">{review.textPreview}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-4 text-sm text-content-muted">
        <h2 className="text-base font-semibold text-content">{t('howItWorksTitle')}</h2>
        <p className="mt-2">{t('howItWorksBody')}</p>
      </section>
    </div>
  );
}

function StatisticsTab({
  stats,
  range,
  loading,
  onRangeChange,
  t,
}: {
  stats: UserStatisticsDto;
  range: UserStatisticsRange;
  loading: boolean;
  onRangeChange: (range: UserStatisticsRange) => void;
  t: ReturnType<typeof useTranslations<'profile'>>;
}) {
  if (!stats.analyticsAvailable) {
    return <EmptyState title={t('analyticsEmpty')} description={t('analyticsEmptyHint')} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {(['3m', '12m', 'all'] as UserStatisticsRange[]).map((option) => (
          <Button
            key={option}
            variant={range === option ? 'primary' : 'secondary'}
            disabled={loading}
            onClick={() => onRangeChange(option)}
          >
            {t(`range.${option}`)}
          </Button>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('timelineTitle')}</h2>
        <ProfileTimelineChart timeline={stats.timeline} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CategoryBars
          title={t('byGenre')}
          items={stats.byGenre}
          empty={t('categoryEmpty')}
          unspecifiedLabel={t('unspecifiedPlatform')}
        />
        <CategoryBars
          title={t('byPlatform')}
          items={stats.byPlatform}
          empty={t('categoryEmpty')}
          unspecifiedLabel={t('unspecifiedPlatform')}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('hoursDistribution')}</h2>
        <HoursBars buckets={stats.hoursPlayedDistribution} t={t} />
      </section>

      <p className="text-xs text-content-subtle">
        {t('activitySummary', {
          months: stats.activity.activeMonths,
          rate: stats.activity.reviewsPerMonth,
          sample: stats.sampleSize,
          avgHours: stats.averageHoursPlayed ?? 0,
        })}
      </p>
    </div>
  );
}

function ReputationTab({
  stats,
  events,
  loading,
  onLoadMore,
  t,
  locale,
}: {
  stats: UserStatisticsDto;
  events: CursorPaginatedResponse<ReputationEventDto> | null;
  loading: boolean;
  onLoadMore: () => void;
  t: ReturnType<typeof useTranslations<'profile'>>;
  locale: string;
}) {
  const common = useTranslations('common');
  const breakdown = stats.reputation.breakdown;

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('reputation')} value={stats.reputation.score} />
        <Stat label={t('tier')} value={t(`tiers.${stats.reputation.tier}`)} />
        <Stat
          label={t('rankingWeight')}
          value={`${Math.round(stats.reputation.rankingWeightRatio * 100)}%`}
        />
        {stats.reputation.moderationNet !== null ? (
          <Stat label={t('moderationNet')} value={stats.reputation.moderationNet} />
        ) : (
          <Stat label={t('reviewsPublished')} value={breakdown.reviewsPublished} />
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('usefulVotesReceived')} value={breakdown.usefulVotesReceived} />
        <Stat label={t('notUsefulVotesReceived')} value={breakdown.notUsefulVotesReceived} />
        <Stat label={t('reviewsPublished')} value={breakdown.reviewsPublished} />
        <Stat label={t('reviewsDeleted')} value={breakdown.reviewsDeleted} />
        {breakdown.moderationPenalties !== undefined ? (
          <Stat label={t('moderationPenalties')} value={breakdown.moderationPenalties} />
        ) : null}
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-4 text-sm text-content-muted">
        <h2 className="text-base font-semibold text-content">{t('howItWorksTitle')}</h2>
        <p className="mt-2">{t('howItWorksBody')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('ledgerTitle')}</h2>
        {!events || events.items.length === 0 ? (
          <EmptyState title={t('ledgerEmpty')} />
        ) : (
          <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
            {events.items.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{t(`reasons.${event.reason}`)}</p>
                  <p className="text-xs text-content-subtle">
                    {new Date(event.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={event.delta >= 0 ? 'text-positive' : 'text-negative'}>
                    {event.delta >= 0 ? `+${event.delta}` : event.delta}
                  </p>
                  <p className="text-xs text-content-subtle">→ {event.balanceAfter}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {events?.meta.hasNextPage ? (
          <div className="flex justify-center">
            <Button variant="secondary" disabled={loading} onClick={onLoadMore}>
              {common('loadMore')}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-subtle">{label}</dt>
      <dd className="score-num text-lg font-semibold">{value}</dd>
    </div>
  );
}

function CategoryBars({
  title,
  items,
  empty,
  unspecifiedLabel,
}: {
  title: string;
  items: UserStatisticsDto['byGenre'];
  empty: string;
  unspecifiedLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <EmptyState title={empty} />
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.reviewCount), 1);

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="space-y-1">
            <div className="flex justify-between gap-2 text-sm">
              <span>{item.key === 'unspecified' ? unspecifiedLabel : item.name}</span>
              <span className="score-num text-content-subtle">
                {item.reviewCount} · {Math.round(item.recommendationPercentage)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-sm bg-surface-hover">
              <div
                className="h-full rounded-sm bg-brand"
                style={{ width: `${(item.reviewCount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HoursBars({
  buckets,
  t,
}: {
  buckets: UserStatisticsDto['hoursPlayedDistribution'];
  t: ReturnType<typeof useTranslations<'profile'>>;
}) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
  if (buckets.every((bucket) => bucket.count === 0)) {
    return <EmptyState title={t('hoursEmpty')} />;
  }

  return (
    <ul className="space-y-2">
      {buckets.map((bucket) => (
        <li key={bucket.bucket} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span>{bucket.bucket}h</span>
            <span className="text-content-subtle">{bucket.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm bg-surface-hover">
            <div
              className="h-full rounded-sm bg-brand"
              style={{ width: `${(bucket.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProfileTimelineChart({ timeline }: { timeline: UserStatisticsDto['timeline'] }) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (timeline.length < 2) return null;
    const width = 640;
    const height = 180;
    const pad = { top: 12, right: 12, bottom: 28, left: 8 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const maxReviews = Math.max(...timeline.map((point) => point.reviews), 1);
    const bars = timeline.map((point, index) => {
      const x = pad.left + (index / Math.max(timeline.length - 1, 1)) * innerW;
      const barWidth = Math.max(2, innerW / timeline.length - 1);
      const recommendedH =
        point.reviews === 0
          ? 0
          : ((point.recommendedCount / point.reviews) * point.reviews) / maxReviews * innerH;
      const notRecommendedH =
        point.reviews === 0
          ? 0
          : (((point.reviews - point.recommendedCount) / point.reviews) * point.reviews) /
            maxReviews *
            innerH;
      return { point, x, barWidth, recommendedH, notRecommendedH, index };
    });
    return { width, height, pad, innerH, bars };
  }, [timeline]);

  if (!chart) {
    return (
      <div className="rounded-card border border-dashed border-border-strong px-4 py-8 text-center text-sm text-content-muted">
        {t('timelineEmpty')}
      </div>
    );
  }

  const active = hover !== null ? chart.bars[hover] : null;

  return (
    <div className="space-y-2">
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-44 w-full min-w-[280px]"
          role="img"
          aria-label={t('timelineTitle')}
        >
          {chart.bars.map((bar) => (
            <g
              key={bar.point.date}
              onMouseEnter={() => setHover(bar.index)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={bar.x - bar.barWidth / 2}
                y={chart.pad.top + chart.innerH - bar.recommendedH - bar.notRecommendedH}
                width={bar.barWidth}
                height={bar.notRecommendedH}
                className="fill-negative/80"
              />
              <rect
                x={bar.x - bar.barWidth / 2}
                y={chart.pad.top + chart.innerH - bar.recommendedH}
                width={bar.barWidth}
                height={bar.recommendedH}
                className="fill-positive/80"
              />
              <rect
                x={bar.x - bar.barWidth / 2}
                y={chart.pad.top}
                width={bar.barWidth}
                height={chart.innerH}
                className="fill-transparent"
              />
            </g>
          ))}
          <line
            x1={chart.pad.left}
            x2={chart.width - chart.pad.right}
            y1={chart.pad.top + chart.innerH}
            y2={chart.pad.top + chart.innerH}
            className="stroke-border-subtle"
            strokeWidth={1}
          />
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-subtle">
        <div className="flex gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-positive" />
            {t('timelineRecommended')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-negative" />
            {t('timelineNotRecommended')}
          </span>
        </div>
        {active ? (
          <p>
            {new Date(`${active.point.date}T00:00:00Z`).toLocaleDateString(locale)} ·{' '}
            {active.point.reviews} · {Math.round(active.point.recommendationPercentage)}%
            {active.point.reputationScore !== null
              ? ` · rep ${active.point.reputationScore}`
              : ''}
          </p>
        ) : (
          <p>{t('timelineHint')}</p>
        )}
      </div>
    </div>
  );
}
