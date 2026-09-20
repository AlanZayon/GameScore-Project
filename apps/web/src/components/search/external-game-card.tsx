import type { ExternalGameHitDto } from '@gamescore/types';

import { GameCover } from '@/components/game/game-cover';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';

export function ExternalGameCard({ hit }: { hit: ExternalGameHitDto }) {
  const year = hit.releaseYear;

  return (
    <Link href={`/games/ext/${hit.externalId}`} className="block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover">
        <GameCover
          name={hit.name}
          src={hit.coverImageUrl}
          className="aspect-[2/3] w-full"
          sizes="(max-width: 640px) 50vw, 240px"
        />
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{hit.name}</h3>
          {year ? <p className="text-xs text-content-muted">{year}</p> : null}
          {hit.summary ? <p className="line-clamp-2 text-xs text-content-subtle">{hit.summary}</p> : null}
        </div>
      </Card>
    </Link>
  );
}
