'use client';

import { useTranslations } from 'next-intl';

import {
  AD_FORMAT_MIN_HEIGHT,
  adsAreMock,
  adsAreVisible,
  publicAdsEnv,
  type AdFormat,
} from '@/lib/ads';

export function AdSlot({
  format,
  className,
  label,
}: {
  format: AdFormat;
  className?: string;
  /** Optional slot name shown only in mock chrome. */
  label?: string;
}) {
  const t = useTranslations('ads');

  if (!adsAreVisible()) return null;

  const minHeight = AD_FORMAT_MIN_HEIGHT[format];

  if (!adsAreMock()) {
    // Real AdSense path lands here later (AdsProvider + consent + <ins class="adsbygoogle">).
    return (
      <aside
        className={className}
        aria-label={t('slotAria')}
        style={{ minHeight }}
        data-ad-client={publicAdsEnv.client}
        data-ad-format={format}
      />
    );
  }

  return (
    <aside
      className={`relative overflow-hidden rounded-card border border-dashed border-border-strong bg-surface-hover/60 ${className ?? ''}`}
      style={{ minHeight }}
      aria-label={t('mockAria')}
    >
      <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(0,0,0,0.03)_8px,rgba(0,0,0,0.03)_16px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(255,255,255,0.04)_8px,rgba(255,255,255,0.04)_16px)]" />
      <div className="relative flex h-full min-h-[inherit] flex-col items-center justify-center gap-1 px-4 py-6 text-center">
        <span className="rounded bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
          {t('mockBadge')}
        </span>
        <p className="text-sm font-medium text-content">{label ?? t('mockTitle')}</p>
        <p className="max-w-xs text-xs text-content-subtle">{t('mockHint')}</p>
        <p className="text-[10px] text-content-subtle">
          {format} · {publicAdsEnv.client}
        </p>
      </div>
    </aside>
  );
}
