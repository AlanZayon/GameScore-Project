'use client';

import type { GameScoreDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { ScoreBadge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';

export function ScorePanel({
  score,
  scoreExcludingReviewBombs,
  hasReviewBombEvents = false,
}: {
  score: GameScoreDto;
  scoreExcludingReviewBombs?: GameScoreDto | null;
  hasReviewBombEvents?: boolean;
}) {
  const t = useTranslations('score');
  const positiveWidth = score.totalReviews === 0 ? 0 : score.positivePercentage;
  const alt =
    scoreExcludingReviewBombs && scoreExcludingReviewBombs.totalReviews !== score.totalReviews
      ? scoreExcludingReviewBombs
      : null;

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
      {score.averageRating != null && score.ratingCount > 0 ? (
        <p className="mt-2 text-xs text-content-muted">
          {t('averageRating', { value: score.averageRating.toFixed(1), count: score.ratingCount })}
        </p>
      ) : null}
      {hasReviewBombEvents ? <p className="mt-3 text-xs text-mixed">{t('bombHint')}</p> : null}
      {alt ? (
        <p className="mt-2 text-xs text-content-subtle">
          {t('excludingBombs', { value: Math.round(alt.positivePercentage) })}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-content-subtle">{t('confidenceHint')}</p>
      <Link href="/scoring" className="mt-3 inline-block text-xs text-brand hover:underline">
        {t('learnMore')}
      </Link>
    </div>
  );
}
