'use client';

import type { ExternalGamePreviewDto, GameScoreDto, PlatformDto } from '@gamescore/types';
import { slugify } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { ReviewForm } from '@/components/game/review-form';
import { ScorePanel } from '@/components/game/score-panel';
import { GameCover } from '@/components/game/game-cover';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { loginPath } from '@/lib/safe-next';

const EMPTY_SCORE: GameScoreDto = {
  totalReviews: 0,
  positiveReviews: 0,
  negativeReviews: 0,
  positivePercentage: 0,
  confidenceScore: 0,
  label: 'NO_REVIEWS',
  averageRating: null,
  ratingCount: 0,
};

function previewPlatforms(preview: ExternalGamePreviewDto): PlatformDto[] {
  return preview.platforms.map((platform) => {
    const slug = slugify(platform.abbreviation || platform.name) || slugify(platform.name);
    return {
      id: slug,
      slug,
      name: platform.name,
      abbreviation: platform.abbreviation,
      family: 'OTHER',
    };
  });
}

export function ExternalGameClient({ preview }: { preview: ExternalGamePreviewDto }) {
  const t = useTranslations('game');
  const reviewsT = useTranslations('reviews');
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const platforms = useMemo(() => previewPlatforms(preview), [preview]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex gap-5">
          <GameCover
            name={preview.name}
            src={preview.coverImageUrl}
            className="h-48 w-36 shrink-0 rounded-card"
            sizes="144px"
            priority
          />
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{preview.name}</h1>
            <p className="text-content-muted">{preview.summary}</p>
            <div className="flex flex-wrap gap-2">
              {preview.platforms.map((platform) => (
                <Badge key={`${platform.abbreviation}-${platform.name}`}>{platform.abbreviation}</Badge>
              ))}
              {preview.genres.map((genre) => (
                <Badge key={genre.name} tone="brand">
                  {genre.name}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-content-subtle">
              {[preview.developer, preview.publisher, preview.releaseDate?.slice(0, 4)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <p className="text-sm text-content-muted">{t('importCta')}</p>

        {user ? (
          <ReviewForm
            externalId={preview.externalId}
            platforms={platforms}
            onSaved={(review) => {
              router.replace(`/games/${review.game.slug}`);
              router.refresh();
            }}
          />
        ) : (
          <p className="text-sm text-content-muted">
            <Link href={loginPath(pathname)} className="text-brand underline">
              {reviewsT('loginToReview')}
            </Link>
          </p>
        )}
      </div>

      <aside className="space-y-4">
        <ScorePanel score={EMPTY_SCORE} />
      </aside>
    </div>
  );
}
