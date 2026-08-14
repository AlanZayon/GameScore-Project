'use client';

import type { GameScoreDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { ScoreBadge } from '@/components/ui/badge';

export function ScorePanel({ score }: { score: GameScoreDto }) {
  const t = useTranslations('score');
  const positiveWidth = score.totalReviews === 0 ? 0 : score.positivePercentage;

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-content-subtle">{t('gameScore')}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-4xl font-bold">
          {score.totalReviews === 0 ? '—' : `${Math.round(score.positivePercentage)}%`}
        </p>
        <ScoreBadge label={score.label} text={t(`labels.${score.label}`)} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-hover">
        <div className="h-full bg-positive" style={{ width: `${positiveWidth}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-content-muted">
        <span>
          {t('positive')}: {score.positiveReviews}
        </span>
        <span>
          {t('negative')}: {score.negativeReviews}
        </span>
      </div>
      <p className="mt-3 text-xs text-content-subtle">{t('confidenceHint')}</p>
    </div>
  );
}
