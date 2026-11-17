import type { Metadata } from 'next';

import { routing, type AppLocale } from '@/i18n/routing';
import { publicEnv } from '@/lib/env';

/** Absolute public origin used for canonicals, Open Graph and JSON-LD. */
export function siteOrigin(): string {
  return publicEnv.siteUrl.replace(/\/$/, '');
}

/**
 * Locale-aware path. Default locale (pt-BR) has no prefix; English uses `/en`.
 * `path` should start with `/` or be empty/`/` for the home page.
 */
export function localizedPath(locale: string, path = '/'): string {
  const normalized =
    !path || path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`;
  if (locale === routing.defaultLocale) {
    return normalized;
  }
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`;
}

export function absoluteUrl(locale: string, path = '/'): string {
  const localized = localizedPath(locale, path);
  return localized === '/' ? siteOrigin() : `${siteOrigin()}${localized}`;
}

/**
 * Build alternates where the canonical matches the *current* locale URL
 * and hreflang covers every supported locale.
 */
export function buildLocaleAlternates(locale: string, path = '/') {
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = absoluteUrl(loc, path);
  }
  return {
    canonical: absoluteUrl(locale, path),
    languages,
  };
}

export type PageMetadataInput = {
  locale: string;
  /** Path without locale prefix, e.g. `/games` or `/`. */
  path: string;
  title: string;
  description: string;
  images?: string[];
  robots?: Metadata['robots'];
  openGraphType?: 'website' | 'article' | 'profile';
  /** When true, title is used as-is (no `%s — GameScore` template). */
  absoluteTitle?: boolean;
};

export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  images,
  robots,
  openGraphType = 'website',
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(locale, path);
  const ogImages = images?.filter(Boolean).map((url) => ({ url }));

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: buildLocaleAlternates(locale, path),
    robots,
    openGraph: {
      type: openGraphType,
      siteName: 'GameScore',
      title,
      description,
      url,
      locale,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images?.filter(Boolean),
    },
  };
}

/** Shared noindex metadata for auth / private surfaces. */
export function buildNoIndexMetadata(
  locale: string,
  path: string,
  title: string,
  description?: string,
): Metadata {
  return buildPageMetadata({
    locale,
    path,
    title,
    description: description ?? title,
    robots: { index: false, follow: false },
  });
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationJsonLd(description: string): Record<string, unknown> {
  return {
    '@type': 'Organization',
    name: 'GameScore',
    url: siteOrigin(),
    description,
  };
}

export function webSiteJsonLd(locale: string, description: string): Record<string, unknown> {
  const searchPath = localizedPath(locale, '/search');
  const target = `${siteOrigin()}${searchPath}?q={search_term_string}`;
  return {
    '@type': 'WebSite',
    name: 'GameScore',
    url: absoluteUrl(locale, '/'),
    description,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: target,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(
  locale: string,
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(locale, item.path),
    })),
  };
}

export function videoGameJsonLd(input: {
  locale: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  genres: string[];
  releaseDate: string | null;
  positivePercentage: number;
  totalReviews: number;
}): Record<string, unknown> {
  const url = absoluteUrl(input.locale, `/games/${input.slug}`);
  const data: Record<string, unknown> = {
    '@type': 'VideoGame',
    name: input.name,
    url,
    description: input.description ?? input.name,
    inLanguage: input.locale,
  };
  if (input.image) data.image = input.image;
  if (input.genres.length > 0) data.genre = input.genres;
  if (input.releaseDate) data.datePublished = input.releaseDate;
  if (input.totalReviews > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.positivePercentage,
      bestRating: 100,
      worstRating: 0,
      ratingCount: input.totalReviews,
    };
  }
  return data;
}

export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}
