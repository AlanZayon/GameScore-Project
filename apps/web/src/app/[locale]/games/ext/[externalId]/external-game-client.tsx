'use client';

import type { ExternalGamePreviewDto, GameScoreDto, PlatformDto } from '@gamescore/types';
import { slugify } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { ReviewForm } from '@/components/game/review-form';
import { ScorePanel } from '@/components/game/score-panel';
import { GameCover } from '@/components/game/game-cover';
import { GameMedia } from '@/components/game/game-media';
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
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        <div className="flex gap-4">
          <GameCover
            name={preview.name}
            src={preview.coverImageUrl}
            className="h-40 w-28 shrink-0 rounded-card sm:h-48 sm:w-36"
            sizes="144px"
            priority
          />
          <div className="min-w-0 space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{preview.name}</h1>
            <p className="text-sm text-content-muted">{preview.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {preview.platforms.map((platform) => (
                <Badge key={`${platform.abbreviation}-${platform.name}`}>{platform.abbreviation}</Badge>
              ))}
              {preview.genres.map((genre) => (
                <Badge key={genre.name} tone="brand">
                  {genre.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-content-subtle">
              {[preview.developer, preview.publisher, preview.releaseDate?.slice(0, 4)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <GameMedia
          gameName={preview.name}
          trailerYoutubeId={preview.trailerYoutubeId}
          galleryImageUrls={preview.galleryImageUrls ?? []}
        />

        <div className="lg:hidden">
          <ScorePanel score={EMPTY_SCORE} />
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
            <Link href={loginPath(pathname)} className="font-medium text-brand underline">
              {reviewsT('loginToReview')}
            </Link>
          </p>
        )}
      </div>

      <aside className="hidden space-y-3 lg:sticky lg:top-20 lg:block lg:self-start">
        <ScorePanel score={EMPTY_SCORE} />
      </aside>
    </div>
  );
}
