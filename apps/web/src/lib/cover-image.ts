/**
 * Cover helpers for the web app. Seeded placehold.co URLs are treated as
 * missing because apostrophes in game names break HTML `src` attributes and
 * the CDN is unreliable for local demos.
 */

const BAD_COVER_HOSTS = ['placehold.co'];
const OPTIMIZABLE_COVER_HOSTS = ['images.igdb.com', 'cdn.cloudflare.steamstatic.com'];

export function isRemoteCoverUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return !BAD_COVER_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function isOptimizableCoverUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OPTIMIZABLE_COVER_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * IGDB `t_cover_big` is only ~264px wide and looks soft in search/catalogue grids
 * on retina displays. Prefer the 720p portrait variant (~540×720) when present.
 */
export function upgradeIgdbCoverUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'images.igdb.com' && !parsed.hostname.endsWith('.images.igdb.com')) {
      return url;
    }
    return url.replace(/\/t_[^/]+\//, '/t_720p/');
  } catch {
    return url;
  }
}

export function resolveCoverImageUrl(name: string, url: string | null | undefined): string | null {
  if (isRemoteCoverUrl(url)) return upgradeIgdbCoverUrl(url);
  return null;
}
