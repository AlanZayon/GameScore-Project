import type { ExternalGameHitDto } from '@gamescore/types';

import { GameCover } from '@/components/game/game-cover';
import { Link } from '@/i18n/navigation';

export function ExternalGameCard({ hit }: { hit: ExternalGameHitDto }) {
  const year = hit.releaseYear;

  return (
    <Link
      href={`/games/ext/${hit.externalId}`}
      className="flex min-h-12 items-center gap-2.5 border-b border-border-subtle px-1 py-2 transition-colors duration-100 hover:bg-surface-hover"
    >
      <GameCover name={hit.name} src={hit.coverImageUrl} className="h-11 w-8 shrink-0 rounded-sm" sizes="32px" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug">{hit.name}</p>
        <p className="truncate text-xs text-content-muted">
          {[year, hit.summary].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  );
}
