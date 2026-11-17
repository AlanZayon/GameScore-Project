import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { qs } from '@/lib/api';
import { serverEnv } from '@/lib/env';
import { absoluteUrl } from '@/lib/seo';
import type { GameSummaryDto, PaginatedResponse } from '@gamescore/types';

export const revalidate = 3600;

const STATIC_PATHS = [
  '/',
  '/games',
  '/rankings',
  '/scoring',
  '/terms',
  '/privacy',
  '/cookies',
] as const;

const PAGE_SIZE = 50;

async function fetchGameSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    try {
      const response = await fetch(
        `${serverEnv.internalApiUrl}/games${qs({ page, limit: PAGE_SIZE, sort: 'POPULAR' })}`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate },
        },
      );
      if (!response.ok) break;
      const payload = (await response.json()) as PaginatedResponse<GameSummaryDto>;
      for (const game of payload.items) {
        if (game.slug) slugs.push(game.slug);
      }
      totalPages = Math.max(1, payload.meta.totalPages);
      if (!payload.meta.hasNextPage) break;
      page += 1;
    } catch {
      break;
    }
  }

  return slugs;
}

function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(locale, path);
  }
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(locale, path),
        changeFrequency: path === '/' ? 'daily' : 'weekly',
        priority: path === '/' ? 1 : path === '/games' || path === '/rankings' ? 0.9 : 0.6,
        alternates: {
          languages: languageAlternates(path),
        },
      });
    }
  }

  const slugs = await fetchGameSlugs();
  for (const slug of slugs) {
    const path = `/games/${slug}`;
    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(locale, path),
        changeFrequency: 'daily',
        priority: 0.8,
        alternates: {
          languages: languageAlternates(path),
        },
      });
    }
  }

  return entries;
}
