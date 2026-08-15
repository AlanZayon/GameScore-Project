'use client';

import type { GameSummaryDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';

import { GameCover } from '@/components/game/game-cover';
import { Link } from '@/i18n/navigation';
import { ScoreBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export function GameCard({
  game,
  priority = false,
}: {
  game: GameSummaryDto;
  priority?: boolean;
}) {
  const t = useTranslations('score');
  const year = game.releaseDate ? game.releaseDate.slice(0, 4) : null;

  return (
    <Link href={`/games/${game.slug}`} className="block h-full">
      <Card className="flex h-full overflow-hidden transition hover:border-brand/40 hover:bg-surface-hover">
        <GameCover
          name={game.name}
          src={game.coverImageUrl}
          className="h-36 w-28 shrink-0"
          sizes="112px"
          priority={priority}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div>
            <h3 className="truncate font-semibold">{game.name}</h3>
            <p className="truncate text-xs text-content-muted">
              {[year, game.developer].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <ScoreBadge label={game.score.label} text={t(`labels.${game.score.label}`)} />
            <span className="text-xs text-content-subtle">
              {game.score.totalReviews > 0 ? `${Math.round(game.score.positivePercentage)}%` : '—'}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
