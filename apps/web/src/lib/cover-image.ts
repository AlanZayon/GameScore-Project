/**
 * Cover helpers for the web app. Seeded placehold.co URLs are treated as
 * missing because apostrophes in game names break HTML `src` attributes and
 * the CDN is unreliable for local demos.
 */

const BAD_COVER_HOSTS = ['placehold.co'];

export function isRemoteCoverUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith('data:')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return !BAD_COVER_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Used for OpenGraph tags — never emit a broken placehold URL. */
export function resolveCoverImageUrl(name: string, url: string | null | undefined): string | null {
  if (isRemoteCoverUrl(url)) return url;
  return null;
}
