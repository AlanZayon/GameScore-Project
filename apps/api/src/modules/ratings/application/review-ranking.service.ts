import { Injectable } from '@nestjs/common';
import { calculateReviewScoreValue } from '@gamescore/shared';

import type { PrismaTransaction } from '../../../common/prisma/prisma.service';

export interface ReviewRankingInput {
  usefulVotes: number;
  notUsefulVotes: number;
  authorReputation: number;
  textLength: number;
  hoursPlayed?: number | null;
  rating?: number | null;
  createdAt: Date;
}

@Injectable()
export class ReviewRankingService {
  score(input: ReviewRankingInput): number {
    const ageInDays = Math.max(0, (Date.now() - input.createdAt.getTime()) / 86_400_000);
    return calculateReviewScoreValue({
      usefulVotes: input.usefulVotes,
      notUsefulVotes: input.notUsefulVotes,
      authorReputation: input.authorReputation,
      textLength: input.textLength,
      hoursPlayed: input.hoursPlayed,
      rating: input.rating,
      ageInDays,
    });
  }

  async persist(reviewId: string, rankingScore: number, tx: PrismaTransaction): Promise<void> {
    await tx.review.update({
      where: { id: reviewId },
      data: { rankingScore },
    });
  }
}
