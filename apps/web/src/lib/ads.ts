/**
 * Ads / affiliate visibility.
 *
 * Opt-in via NEXT_PUBLIC_ADS_ENABLED=true.
 * Mocks never render in production (even if misconfigured).
 * In local/dev, set ENABLED=true and MOCK=true to preview placeholders.
 */

export type AdFormat = 'sidebar' | 'inArticle' | 'horizontal';

const isProduction = process.env.NODE_ENV === 'production';

export const publicAdsEnv = {
  /** Explicit opt-in. Default off so production stays clean until AdSense is approved. */
  enabled: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',
  /** Placeholder chrome instead of Google scripts. Ignored in production. */
  mock: process.env.NEXT_PUBLIC_ADS_MOCK === 'true',
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? 'ca-pub-0000000000000000',
} as const;

/** True when any ad/affiliate UI may render. */
export function adsAreVisible(): boolean {
  if (!publicAdsEnv.enabled) return false;
  // Never ship mock placeholders to production users.
  if (publicAdsEnv.mock && isProduction) return false;
  return true;
}

/** True when the UI should paint the dashed mock slot (dev preview only). */
export function adsAreMock(): boolean {
  return publicAdsEnv.mock && !isProduction;
}

/** Reserved heights keep layout stable (anti-CLS) when creatives load. */
export const AD_FORMAT_MIN_HEIGHT: Record<AdFormat, number> = {
  sidebar: 280,
  inArticle: 120,
  horizontal: 100,
};

/**
 * Seed Steam app ids keyed by game slug — covers are already CDN URLs from
 * these ids; affiliates use the same map until the API stores store links.
 */
export const SEED_STEAM_APP_IDS: Record<string, number> = {
  'elden-ring': 1245620,
  'the-witcher-3-wild-hunt': 292030,
  hades: 1145360,
  'stardew-valley': 413150,
  'baldurs-gate-3': 1086940,
  celeste: 504230,
  'disco-elysium': 632470,
  'hollow-knight': 367520,
  'portal-2': 620,
  'red-dead-redemption-2': 1174180,
  'cyberpunk-2077': 1091500,
  starfield: 1716740,
  'assassins-creed-valhalla': 2208920,
  'fifa-23': 1811260,
  concord: 2091600,
  'the-day-before': 1372880,
  'skull-and-bones': 1987080,
  'outer-wilds': 753640,
  'animal-well': 813450,
  balatro: 2379780,
  'pacific-drive': 1347750,
};

export function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}/`;
}
