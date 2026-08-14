import type { ReviewDto } from '@gamescore/types';

import { toPlatformDto } from '../../games/mappers/game.mapper';
import { toUserSummary } from '../../users/mappers/user.mapper';
import type { ReviewWithRelations } from '../repositories/review.repository';

export function toReviewDto(
  review: ReviewWithRelations,
  extras: {
    viewerId?: string | null;
    viewerVote?: boolean | null;
    viewerHasReported?: boolean;
  } = {},
): ReviewDto {
  return {
    id: review.id,
    author: toUserSummary(review.user),
    game: review.game,
    recommended: review.recommended,
    rating: review.rating,
    text: review.text,
    hoursPlayed: review.hoursPlayed,
    platform: review.platform ? toPlatformDto(review.platform) : null,
    usefulCount: review.usefulCount,
    notUsefulCount: review.notUsefulCount,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    edited: review.edited,
    status: review.status,
    moderationStatus: review.moderationStatus,
    viewerVote:
      extras.viewerVote === true ? 'USEFUL' : extras.viewerVote === false ? 'NOT_USEFUL' : null,
    viewerIsAuthor: extras.viewerId === review.userId,
    viewerHasReported: extras.viewerHasReported ?? false,
  };
}
