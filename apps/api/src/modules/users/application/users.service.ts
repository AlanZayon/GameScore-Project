import { Injectable } from '@nestjs/common';
import type { CursorPaginatedResponse, ReviewDto, UserProfile } from '@gamescore/types';

import { clampLimit, cursorMeta, DEFAULT_CURSOR_SIZE } from '../../../common/http/pagination';
import { NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toUserProfile } from '../mappers/user.mapper';
import { UserRepository } from '../repositories/user.repository';
import { ReviewRepository } from '../../reviews/repositories/review.repository';
import { toReviewDto } from '../../reviews/mappers/review.mapper';
import type { AuthUser } from '../../auth/domain/auth-user';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UserRepository,
    private readonly reviews: ReviewRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getProfile(username: string): Promise<UserProfile> {
    const user = await this.users.findProfileByUsername(username);
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }

    const [reviewAgg, usefulVotes, hours] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['recommended'],
        where: { userId: user.id, deletedAt: null, status: 'PUBLISHED' },
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { userId: user.id, deletedAt: null },
        _sum: { usefulCount: true },
      }),
      this.prisma.review.aggregate({
        where: { userId: user.id, deletedAt: null, hoursPlayed: { not: null } },
        _sum: { hoursPlayed: true },
      }),
    ]);

    let recommended = 0;
    let notRecommended = 0;
    for (const row of reviewAgg) {
      if (row.recommended) recommended += row._count._all;
      else notRecommended += row._count._all;
    }
    const totalReviews = recommended + notRecommended;

    return toUserProfile(user, {
      totalReviews,
      recommendedCount: recommended,
      notRecommendedCount: notRecommended,
      recommendationPercentage:
        totalReviews === 0 ? 0 : Math.round((recommended / totalReviews) * 10000) / 100,
      usefulVotesReceived: usefulVotes._sum.usefulCount ?? 0,
      gamesReviewed: totalReviews,
      totalHoursPlayed: hours._sum.hoursPlayed ?? 0,
    });
  }

  async listReviews(
    username: string,
    cursor: string | undefined,
    limit: number | undefined,
    viewer?: AuthUser | null,
  ): Promise<CursorPaginatedResponse<ReviewDto>> {
    const user = await this.users.findProfileByUsername(username);
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }

    const pageSize = clampLimit(limit, DEFAULT_CURSOR_SIZE);
    const { items, nextCursor } = await this.reviews.listByUser(user.id, cursor, pageSize);
    const context = viewer
      ? await this.reviews.viewerContext(
          items.map((item) => item.id),
          viewer.id,
        )
      : { votes: new Map<string, boolean>(), reports: new Set<string>() };

    return {
      items: items.map((item) =>
        toReviewDto(item, {
          viewerId: viewer?.id,
          viewerVote: context.votes.has(item.id) ? context.votes.get(item.id)! : null,
          viewerHasReported: context.reports.has(item.id),
        }),
      ),
      meta: cursorMeta(pageSize, nextCursor),
    };
  }
}
