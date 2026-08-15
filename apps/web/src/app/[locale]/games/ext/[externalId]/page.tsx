import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ExternalGameClient } from './external-game-client';
import { apiFetch, ApiError } from '@/lib/api';
import { resolveCoverImageUrl } from '@/lib/cover-image';
import { publicEnv } from '@/lib/env';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type { ExternalGamePreviewDto } from '@gamescore/types';
import { cache } from 'react';

const loadPreview = cache(async (externalId: string) => {
  try {
    return await apiFetch<ExternalGamePreviewDto>(`/search/external/${externalId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; externalId: string }>;
}): Promise<Metadata> {
  const { locale, externalId } = await params;
  const preview = await loadPreview(externalId);
  if (!preview) return { title: 'GameScore' };

  const title = preview.name;
  const description = preview.summary ?? preview.name;
  const path =
    locale === routing.defaultLocale
      ? `/games/ext/${externalId}`
      : `/${locale}/games/ext/${externalId}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${publicEnv.siteUrl}${path}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: (() => {
        const cover = resolveCoverImageUrl(preview.name, preview.coverImageUrl);
        return cover ? [{ url: cover }] : undefined;
      })(),
    },
  };
}

export default async function ExternalGamePage({
  params,
}: {
  params: Promise<{ locale: string; externalId: string }>;
}) {
  const { locale, externalId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('game');

  const preview = await loadPreview(externalId);
  if (!preview) notFound();

  if (preview.localSlug) {
    redirect({ href: `/games/${preview.localSlug}`, locale });
  }

  return (
    <main className="container-page space-y-8 py-8">
      <p className="sr-only">{t('title')}</p>
      <ExternalGameClient preview={preview} />
    </main>
  );
}
