import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ProfilePageClient } from '@/components/profile/profile-page-client';
import { apiFetch, ApiError } from '@/lib/api';
import type {
  CursorPaginatedResponse,
  ReviewDto,
  UserProfile,
  UserStatisticsDto,
} from '@gamescore/types';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  await getTranslations('profile');

  let profile: UserProfile;
  try {
    profile = await apiFetch<UserProfile>(`/users/${username}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [reviews, statistics] = await Promise.all([
    apiFetch<CursorPaginatedResponse<ReviewDto>>(`/users/${username}/reviews`),
    apiFetch<UserStatisticsDto>(`/users/${username}/statistics?range=all`),
  ]);

  return (
    <ProfilePageClient
      profile={profile}
      initialReviews={reviews}
      initialStatistics={statistics}
    />
  );
}
