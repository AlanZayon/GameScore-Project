'use client';

import type { ReviewTimelinePointDto } from '@gamescore/types';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const MIN_POINTS = 2;

export function ReviewTimelineChart({ timeline }: { timeline: ReviewTimelinePointDto[] }) {
  const t = useTranslations('game');
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (timeline.length < MIN_POINTS) return null;
    const width = 640;
    const height = 180;
    const pad = { top: 12, right: 12, bottom: 28, left: 8 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const maxTotal = Math.max(...timeline.map((point) => point.total), 1);

    const bars = timeline.map((point, index) => {
      const x = pad.left + (index / Math.max(timeline.length - 1, 1)) * innerW;
      const barWidth = Math.max(2, innerW / timeline.length - 1);
      const positiveH = (point.positive / maxTotal) * innerH;
      const negativeH = (point.negative / maxTotal) * innerH;
      return { point, x, barWidth, positiveH, negativeH, index };
    });

    return { width, height, pad, innerH, bars, maxTotal };
  }, [timeline]);

  if (!chart) {
    return (
      <div className="rounded-card border border-dashed border-border-strong px-4 py-8 text-center text-sm text-content-muted">
        {t('timelineEmpty')}
      </div>
    );
  }

  const active = hover !== null ? chart.bars[hover] : null;

  return (
    <div className="space-y-2">
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-44 w-full min-w-[280px]"
          role="img"
          aria-label={t('timelineTitle')}
        >
          {chart.bars.map((bar) => (
            <g
              key={bar.point.date}
              onMouseEnter={() => setHover(bar.index)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={bar.x - bar.barWidth / 2}
                y={chart.pad.top + chart.innerH - bar.positiveH - bar.negativeH}
                width={bar.barWidth}
                height={bar.negativeH}
                className="fill-negative/80"
              />
              <rect
                x={bar.x - bar.barWidth / 2}
                y={chart.pad.top + chart.innerH - bar.positiveH}
                width={bar.barWidth}
                height={bar.positiveH}
                className="fill-positive/80"
              />
              <rect
                x={bar.x - bar.barWidth / 2}
                y={chart.pad.top}
                width={bar.barWidth}
                height={chart.innerH}
                className="fill-transparent"
              />
            </g>
          ))}
          <line
            x1={chart.pad.left}
            x2={chart.width - chart.pad.right}
            y1={chart.pad.top + chart.innerH}
            y2={chart.pad.top + chart.innerH}
            className="stroke-border-subtle"
            strokeWidth={1}
          />
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-subtle">
        <div className="flex gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-positive" />
            {t('timelinePositive')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-negative" />
            {t('timelineNegative')}
          </span>
        </div>
        {active ? (
          <p>
            {new Date(`${active.point.date}T00:00:00Z`).toLocaleDateString(locale)} · +
            {active.point.positive} / −{active.point.negative} ({active.point.total})
          </p>
        ) : (
          <p>{t('timelineHint')}</p>
        )}
      </div>
    </div>
  );
}
