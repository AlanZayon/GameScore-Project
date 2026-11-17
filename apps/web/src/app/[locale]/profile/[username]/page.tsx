import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { ProfilePageClient } from '@/components/profile/profile-page-client';
import { apiFetch, ApiError } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';
import type {
  CursorPaginatedResponse,
  ReviewDto,
  UserProfile,
  UserStatisticsDto,
} from '@gamescore/types';

const loadProfile = cache(async (username: string) => {
  try {
    return await apiFetch<UserProfile>(`/users/${username}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await params;
  const profile = await loadProfile(username);
  if (!profile) return { title: 'GameScore', robots: { index: false, follow: false } };

  const t = await getTranslations({ locale, namespace: 'profile' });
  const name = profile.displayName?.trim() || profile.username;
  const bio = profile.bio?.trim();
  const description = bio
    ? t('metaDescriptionBio', { bio: bio.slice(0, 155) })
    : t('metaDescription', { name });

  return buildPageMetadata({
    locale,
    path: `/profile/${profile.username}`,
    title: t('metaTitle', { name }),
    description,
    openGraphType: 'profile',
    images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
  });
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  await getTranslations('profile');

  const profile = await loadProfile(username);
  if (!profile) notFound();

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
