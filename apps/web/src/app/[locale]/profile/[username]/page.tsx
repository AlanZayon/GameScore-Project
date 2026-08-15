import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Avatar } from '@/components/ui/avatar';
import { ProfileEditLink } from '@/components/profile/profile-edit-link';
import { ProfileReviews } from '@/components/profile/profile-reviews';
import { apiFetch, ApiError } from '@/lib/api';
import type { CursorPaginatedResponse, ReviewDto, UserProfile } from '@gamescore/types';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('profile');

  let profile: UserProfile;
  try {
    profile = await apiFetch<UserProfile>(`/users/${username}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const reviews = await apiFetch<CursorPaginatedResponse<ReviewDto>>(`/users/${username}/reviews`);

  return (
    <main className="container-page space-y-8 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName || profile.username} src={profile.avatarUrl} size="lg" />
          <div>
            <h1 className="text-3xl font-bold">{profile.displayName || profile.username}</h1>
            <p className="text-content-muted">@{profile.username}</p>
            {profile.bio ? <p className="mt-2 max-w-xl text-sm text-content-muted">{profile.bio}</p> : null}
            <div className="mt-3">
              <ProfileEditLink username={profile.username} label={t('editProfile')} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label={t('reviews')} value={profile.stats.totalReviews} />
        <Stat label={t('reputation')} value={profile.reputationScore} />
        <Stat label={t('useful')} value={profile.stats.usefulVotesReceived} />
        <Stat label={t('recommendationRate')} value={`${Math.round(profile.stats.recommendationPercentage)}%`} />
        <Stat label={t('hoursPlayed')} value={profile.stats.totalHoursPlayed} />
        <Stat label={t('gamesReviewed')} value={profile.stats.gamesReviewed} />
      </div>
      <ProfileReviews username={username} initial={reviews} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-content-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
