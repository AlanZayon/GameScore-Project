/**
 * Stores image URLs only. Artwork is never downloaded or re-hosted: the
 * metadata provider's CDN is the source of truth, and we only keep a URL we
 * have validated.
 */

const ALLOWED_HOSTS = new Set(['images.igdb.com', 'cdn.cloudflare.steamstatic.com', 'placehold.co']);

export function isAllowedImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** IGDB thumbnails are tiny; prefer a larger size when the URL matches. */
export function normaliseIgdbImageUrl(
  url: string | null | undefined,
  size: 'cover_big' | 'screenshot_huge' | 'screenshot_big',
): string | null {
  if (!url) return null;
  const absolute = url.startsWith('//') ? `https:${url}` : url;
  const upgraded = absolute.replace(/t_(?:thumb|cover_small|screenshot_med|screenshot_big)/, `t_${size}`);
  return isAllowedImageUrl(upgraded) ? upgraded : null;
}

export interface ImageProvider {
  coverUrl(raw: string | null | undefined): string | null;
  bannerUrl(raw: string | null | undefined): string | null;
  galleryUrls(raws: Array<string | null | undefined>, limit?: number): string[];
}

export class CdnImageProvider implements ImageProvider {
  coverUrl(raw: string | null | undefined): string | null {
    return normaliseIgdbImageUrl(raw, 'cover_big');
  }

  bannerUrl(raw: string | null | undefined): string | null {
    return normaliseIgdbImageUrl(raw, 'screenshot_huge');
  }

  galleryUrls(raws: Array<string | null | undefined>, limit = 12): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const raw of raws) {
      const url = normaliseIgdbImageUrl(raw, 'screenshot_huge');
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) break;
    }
    return urls;
  }
}
