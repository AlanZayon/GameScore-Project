'use client';

import { useTranslations } from 'next-intl';

import { adsAreVisible, SEED_STEAM_APP_IDS, steamStoreUrl } from '@/lib/ads';

export function StoreLinks({ slug, gameName }: { slug: string; gameName: string }) {
  const t = useTranslations('ads');
  const appId = SEED_STEAM_APP_IDS[slug];

  if (!adsAreVisible() || !appId) return null;

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{t('buyTitle')}</h2>
        <p className="mt-1 text-xs text-content-muted">{t('buySubtitle')}</p>
      </div>
      <a
        href={steamStoreUrl(appId)}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast hover:bg-brand-hover"
      >
        {t('buySteam')}
      </a>
      <p className="text-[11px] leading-snug text-content-subtle">
        {t('affiliateDisclosure', { name: gameName })}
      </p>
    </section>
  );
}
