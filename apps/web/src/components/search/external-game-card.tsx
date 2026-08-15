import type { ExternalGameHitDto } from '@gamescore/types';

import { GameCover } from '@/components/game/game-cover';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';

export function ExternalGameCard({ hit }: { hit: ExternalGameHitDto }) {
  const year = hit.releaseYear;

  return (
    <Link href={`/games/ext/${hit.externalId}`} className="block h-full">
      <Card className="flex h-full overflow-hidden transition hover:border-brand/40 hover:bg-surface-hover">
        <GameCover name={hit.name} src={hit.coverImageUrl} className="h-36 w-28 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div>
            <h3 className="truncate font-semibold">{hit.name}</h3>
            <p className="truncate text-xs text-content-muted">{year ?? ''}</p>
          </div>
          {hit.summary ? (
            <p className="line-clamp-2 text-xs text-content-subtle">{hit.summary}</p>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
