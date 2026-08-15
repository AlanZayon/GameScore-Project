'use client';

import type { PlatformFamilyScoreDto, PlatformScoreDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Badge, ScoreBadge } from '@/components/ui/badge';

type Mode = 'platform' | 'family';

export function PlatformComparison({
  platforms,
  families,
}: {
  platforms: PlatformScoreDto[];
  families: PlatformFamilyScoreDto[];
}) {
  const t = useTranslations('game');
  const scoreT = useTranslations('score');
  const [mode, setMode] = useState<Mode>(families.length > 0 ? 'family' : 'platform');

  const rows = useMemo(() => {
    if (mode === 'family') {
      return families.map((row) => ({
        key: row.family,
        label: t(`families.${row.family}`),
        positivePercentage: row.positivePercentage,
        totalReviews: row.totalReviews,
        labelScore: row.label,
      }));
    }
    return platforms.map((row) => ({
      key: row.platform.id,
      label: row.platform.abbreviation || row.platform.name,
      positivePercentage: row.positivePercentage,
      totalReviews: row.totalReviews,
      labelScore: row.label,
    }));
  }, [mode, families, platforms, t]);

  const maxPct = Math.max(...rows.map((row) => row.positivePercentage), 1);

  if (platforms.length === 0 && families.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-strong px-4 py-8 text-center text-sm text-content-muted">
        {t('platformCompareEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMode('family')}
          disabled={families.length === 0}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
            mode === 'family'
              ? 'bg-brand text-brand-contrast'
              : 'border border-border-subtle text-content-muted hover:bg-surface-hover'
          }`}
        >
          {t('compareByFamily')}
        </button>
        <button
          type="button"
          onClick={() => setMode('platform')}
          disabled={platforms.length === 0}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
            mode === 'platform'
              ? 'bg-brand text-brand-contrast'
              : 'border border-border-subtle text-content-muted hover:bg-surface-hover'
          }`}
        >
          {t('compareByPlatform')}
        </button>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{row.label}</span>
              <div className="flex items-center gap-2">
                <ScoreBadge label={row.labelScore} text={scoreT(`labels.${row.labelScore}`)} />
                <Badge tone="neutral">
                  {Math.round(row.positivePercentage)}% · {row.totalReviews}
                </Badge>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(row.positivePercentage / maxPct) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
