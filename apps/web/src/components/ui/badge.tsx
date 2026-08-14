import { resolveScoreSentiment, type ScoreLabel } from '@gamescore/shared';

import { cn } from '@/lib/cn';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'mixed' | 'negative' | 'brand';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'neutral' && 'bg-surface-hover text-content-muted',
        tone === 'positive' && 'bg-positive-soft text-positive',
        tone === 'mixed' && 'bg-mixed-soft text-mixed',
        tone === 'negative' && 'bg-negative-soft text-negative',
        tone === 'brand' && 'bg-brand-soft text-brand',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({
  label,
  text,
}: {
  label: ScoreLabel;
  text: string;
}) {
  const sentiment = resolveScoreSentiment(label);
  return <Badge tone={sentiment === 'unknown' ? 'neutral' : sentiment}>{text}</Badge>;
}
