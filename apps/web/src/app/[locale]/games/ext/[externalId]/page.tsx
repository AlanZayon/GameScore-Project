import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { ExternalGameClient } from './external-game-client';
import { apiFetch, ApiError } from '@/lib/api';
import { resolveCoverImageUrl } from '@/lib/cover-image';
import { redirect } from '@/i18n/navigation';
import { buildPageMetadata } from '@/lib/seo';
import type { ExternalGamePreviewDto, PlatformDto } from '@gamescore/types';

const loadPreview = cache(async (externalId: string) => {
  try {
    // Never cache: once the first review imports the game, localSlug must appear immediately.
    return await apiFetch<ExternalGamePreviewDto>(`/search/external/${externalId}`, {
      revalidate: false,
    });
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
  if (!preview) return { title: 'GameScore', robots: { index: false, follow: false } };

  const cover = resolveCoverImageUrl(preview.name, preview.coverImageUrl);
  return buildPageMetadata({
    locale,
    path: `/games/ext/${externalId}`,
    title: preview.name,
    description: preview.summary ?? preview.name,
    images: cover ? [cover] : undefined,
    robots: { index: false, follow: true },
  });
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

  let catalogPlatforms: PlatformDto[] = [];
  try {
    catalogPlatforms = await apiFetch<PlatformDto[]>('/platforms', { revalidate: 3600 });
  } catch {
    catalogPlatforms = [];
  }

  return (
    <main className="container-page space-y-6 py-6">
      <p className="sr-only">{t('title')}</p>
      <ExternalGameClient preview={preview} catalogPlatforms={catalogPlatforms} />
    </main>
  );
}
