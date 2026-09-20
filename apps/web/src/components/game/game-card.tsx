'use client';

import type { GameSummaryDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { GameCover } from '@/components/game/game-cover';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** Dense list row — default listing pattern (mobile and desktop). % leads; label in title only. */
export function GameRow({
  game,
  rank,
  priority = false,
  className,
}: {
  game: GameSummaryDto;
  rank?: number;
  priority?: boolean;
  className?: string;
}) {
  const t = useTranslations('score');
  const year = game.releaseDate ? game.releaseDate.slice(0, 4) : null;
  const label = t(`labels.${game.score.label}`);
  const scoreText =
    game.score.totalReviews > 0 ? `${Math.round(game.score.positivePercentage)}%` : '—';

  return (
    <Link
      href={`/games/${game.slug}`}
      title={label}
      className={cn(
        'flex min-h-12 items-center gap-2.5 border-b border-border-subtle px-1 py-2 transition-colors duration-100 hover:bg-surface-hover',
        className,
      )}
    >
      {rank != null ? (
        <span className="score-num w-6 shrink-0 text-center text-xs font-medium text-content-subtle">
          {rank}
        </span>
      ) : null}
      <GameCover
        name={game.name}
        src={game.coverImageUrl}
        className="h-11 w-8 shrink-0 rounded-sm"
        sizes="32px"
        priority={priority}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug">{game.name}</p>
        <p className="truncate text-xs text-content-muted">
          {[year, game.developer].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className="score-num shrink-0 text-base font-bold leading-none tabular-nums" aria-label={label}>
        {scoreText}
      </span>
    </Link>
  );
}

/** @deprecated Prefer GameRow for lists. */
export function GameCard(props: {
  game: GameSummaryDto;
  priority?: boolean;
}) {
  return <GameRow {...props} />;
}
