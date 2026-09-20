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
      className={`flex items-center justify-center border border-dashed border-border-subtle bg-canvas px-3 py-4 text-center ${className ?? ''}`}
      style={{ minHeight }}
      aria-label={t('mockAria')}
    >
      <p className="text-xs text-content-subtle">
        {label ?? t('mockTitle')}
        <span className="mx-1.5 text-content-subtle/50">·</span>
        {format}
      </p>
    </aside>
  );
}
