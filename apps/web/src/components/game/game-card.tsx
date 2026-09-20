'use client';

import type { GameSummaryDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { GameCover } from '@/components/game/game-cover';
import { Link } from '@/i18n/navigation';
import { ScoreBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

function scoreText(game: GameSummaryDto) {
  return game.score.totalReviews > 0 ? `${Math.round(game.score.positivePercentage)}%` : '—';
}

function platformLine(game: GameSummaryDto) {
  return game.platforms
    .slice(0, 3)
    .map((p) => p.abbreviation || p.name)
    .join(' · ');
}

/** Cover-first tile for home rails — score is the secondary hero under the cover. */
export function GamePoster({
  game,
  priority = false,
  className,
}: {
  game: GameSummaryDto;
  priority?: boolean;
  className?: string;
}) {
  const t = useTranslations('score');
  const common = useTranslations('common');
  const label = t(`labels.${game.score.label}`);
  const year = game.releaseDate ? game.releaseDate.slice(0, 4) : null;
  const platforms = platformLine(game);

  return (
    <Link
      href={`/games/${game.slug}`}
      className={cn(
        'group flex w-[8.5rem] shrink-0 snap-start flex-col sm:w-40 md:w-44',
        className,
      )}
    >
      <div
        className={cn(
          'relative h-[12.75rem] w-full shrink-0 overflow-hidden rounded-md bg-surface-raised transition duration-150',
          'sm:h-[15rem] md:h-[16.5rem]',
        )}
      >
        <GameCover
          name={game.name}
          src={game.coverImageUrl}
          className="absolute inset-0 size-full"
          sizes="176px"
          priority={priority}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-transparent transition duration-150 group-hover:ring-brand/70"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas/95 via-canvas/70 to-transparent px-1.5 pb-1.5 pt-8">
          <p className="score-num text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl">
            {scoreText(game)}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex min-h-[4.5rem] flex-col gap-0.5 sm:min-h-[5rem]">
        <p className="line-clamp-2 text-xs font-semibold leading-snug group-hover:text-brand sm:text-sm">
          {game.name}
        </p>
        <ScoreBadge label={game.score.label} text={label} />
        <p className="truncate text-[11px] text-content-muted">
          {[year, game.developer].filter(Boolean).join(' · ')}
        </p>
        {platforms ? (
          <p className="truncate text-[11px] text-content-subtle">{platforms}</p>
        ) : null}
        {game.score.totalReviews > 0 ? (
          <p className="score-num text-[11px] text-content-muted">
            {common('reviews', { count: game.score.totalReviews })}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** Standalone card for catalogue and rankings — score block dominates the footer. */
export function GameCard({
  game,
  rank,
  priority = false,
}: {
  game: GameSummaryDto;
  rank?: number;
  priority?: boolean;
}) {
  const t = useTranslations('score');
  const common = useTranslations('common');
  const year = game.releaseDate ? game.releaseDate.slice(0, 4) : null;
  const label = t(`labels.${game.score.label}`);
  const platforms = platformLine(game);
  const positiveWidth = game.score.totalReviews === 0 ? 0 : game.score.positivePercentage;

  return (
    <Link href={`/games/${game.slug}`} className="block h-full">
      <Card className="relative flex h-full flex-col overflow-hidden transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover">
        {rank != null ? (
          <span className="score-num absolute left-2 top-2 z-10 rounded-md bg-canvas/90 px-1.5 py-0.5 text-xs font-semibold">
            #{rank}
          </span>
        ) : null}
        <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-surface-raised">
          <GameCover
            name={game.name}
            src={game.coverImageUrl}
            className="absolute inset-0 size-full"
            sizes="(max-width: 640px) 50vw, 240px"
            priority={priority}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{game.name}</h3>
          <p className="truncate text-xs text-content-muted">
            {[year, game.developer].filter(Boolean).join(' · ')}
          </p>
          {platforms ? <p className="truncate text-[11px] text-content-subtle">{platforms}</p> : null}

          <div className="mt-auto space-y-1.5 border-t border-border-subtle pt-2">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <ScoreBadge label={game.score.label} text={label} />
                {game.score.totalReviews > 0 ? (
                  <p className="score-num text-[11px] text-content-muted">
                    {common('reviews', { count: game.score.totalReviews })}
                  </p>
                ) : null}
              </div>
              <p className="score-num shrink-0 text-3xl font-bold leading-none tracking-tight tabular-nums">
                {scoreText(game)}
              </p>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-surface-hover">
              <div className="h-full bg-positive" style={{ width: `${positiveWidth}%` }} />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/** Dense list row — optional compact pattern. */
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

  return (
    <Link
      href={`/games/${game.slug}`}
      className={cn(
        'flex min-h-14 items-center gap-3 border-b border-border-subtle px-1 py-2.5 transition-colors duration-100 hover:bg-surface-hover',
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
        className="h-14 w-10 shrink-0 rounded-sm"
        sizes="40px"
        priority={priority}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug sm:text-base">{game.name}</p>
        <p className="truncate text-xs text-content-muted">
          {[year, game.developer].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="score-num text-2xl font-bold leading-none tabular-nums">{scoreText(game)}</span>
        <ScoreBadge label={game.score.label} text={label} />
      </div>
    </Link>
  );
}
