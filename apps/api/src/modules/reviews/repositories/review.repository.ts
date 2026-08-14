import { Injectable } from '@nestjs/common';
import type { ReviewRecommendationFilter, ReviewSort } from '@gamescore/shared';
import type { Prisma, Review } from '@prisma/client';

import { decodeCursor, encodeCursor } from '../../../common/http/pagination';
import { PrismaService, type PrismaTransaction } from '../../../common/prisma/prisma.service';
import { publicUserSelect } from '../../users/repositories/user.repository';

export const reviewListInclude = {
  user: { select: publicUserSelect },
  platform: true,
  game: { select: { id: true, slug: true, name: true, coverImageUrl: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof reviewListInclude }>;

export interface ListReviewsFilters {
  gameId: string;
  sort: ReviewSort;
  recommendation: ReviewRecommendationFilter;
  platformId?: string;
  minHoursPlayed?: number;
  maxHoursPlayed?: number;
  viewerId?: string;
  cursor?: string;
  limit: number;
}

export interface CreateReviewData {
  gameId: string;
  userId: string;
  recommended: boolean;
  text: string;
  rating?: number | null;
  hoursPlayed?: number | null;
  platformId?: string | null;
  rankingScore: number;
  textFingerprint: string;
  authorIpHash: string | null;
  moderationStatus: Review['moderationStatus'];
}

interface RankingCursor {
  rankingScore: number;
  id: string;
}

interface RecentCursor {
  createdAt: string;
  id: string;
}

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: PrismaTransaction): PrismaTransaction {
    return tx ?? this.prisma;
  }

  async findById(id: string, tx?: PrismaTransaction): Promise<ReviewWithRelations | null> {
    return this.client(tx).review.findUnique({
      where: { id },
      include: reviewListInclude,
    });
  }

  async findActiveByUserAndGame(
    userId: string,
    gameId: string,
    tx?: PrismaTransaction,
  ): Promise<Review | null> {
    return this.client(tx).review.findFirst({
      where: { userId, gameId, deletedAt: null },
    });
  }

  async create(data: CreateReviewData, tx?: PrismaTransaction): Promise<ReviewWithRelations> {
    return this.client(tx).review.create({
      data,
      include: reviewListInclude,
    });
  }

  async update(
    id: string,
    data: Prisma.ReviewUncheckedUpdateInput,
    tx?: PrismaTransaction,
  ): Promise<ReviewWithRelations> {
    return this.client(tx).review.update({
      where: { id },
      data,
      include: reviewListInclude,
    });
  }

  async list(filters: ListReviewsFilters): Promise<{ items: ReviewWithRelations[]; nextCursor: string | null }> {
    const where: Prisma.ReviewWhereInput = {
      gameId: filters.gameId,
      deletedAt: null,
      status: 'PUBLISHED',
    };

    if (filters.recommendation === 'POSITIVE') where.recommended = true;
    if (filters.recommendation === 'NEGATIVE') where.recommended = false;
    if (filters.platformId) where.platformId = filters.platformId;
    if (filters.minHoursPlayed != null || filters.maxHoursPlayed != null) {
      where.hoursPlayed = {
        ...(filters.minHoursPlayed != null ? { gte: filters.minHoursPlayed } : {}),
        ...(filters.maxHoursPlayed != null ? { lte: filters.maxHoursPlayed } : {}),
      };
    }

    const take = filters.limit + 1;
    let items: ReviewWithRelations[];

    if (filters.sort === 'RECENT') {
      const cursor = filters.cursor ? decodeCursor<RecentCursor>(filters.cursor) : null;
      items = await this.prisma.review.findMany({
        where: {
          ...where,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(cursor.createdAt) } },
                  { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        include: reviewListInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
      });
    } else if (filters.sort === 'MOST_USEFUL') {
      const cursor = filters.cursor ? decodeCursor<RankingCursor>(filters.cursor) : null;
      items = await this.prisma.review.findMany({
        where: {
          ...where,
          ...(cursor
            ? {
                OR: [
                  { usefulCount: { lt: cursor.rankingScore } },
                  { usefulCount: cursor.rankingScore, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        include: reviewListInclude,
        orderBy: [{ usefulCount: 'desc' }, { id: 'desc' }],
        take,
      });
    } else {
      const cursor = filters.cursor ? decodeCursor<RankingCursor>(filters.cursor) : null;
      items = await this.prisma.review.findMany({
        where: {
          ...where,
          ...(cursor
            ? {
                OR: [
                  { rankingScore: { lt: cursor.rankingScore } },
                  { rankingScore: cursor.rankingScore, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        include: reviewListInclude,
        orderBy: [{ rankingScore: 'desc' }, { id: 'desc' }],
        take,
      });
    }

    const hasMore = items.length > filters.limit;
    const page = hasMore ? items.slice(0, filters.limit) : items;
    const last = page[page.length - 1];

    let nextCursor: string | null = null;
    if (hasMore && last) {
      nextCursor =
        filters.sort === 'RECENT'
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : encodeCursor({
              rankingScore: filters.sort === 'MOST_USEFUL' ? last.usefulCount : last.rankingScore,
              id: last.id,
            });
    }

    return { items: page, nextCursor };
  }

  async listByUser(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: ReviewWithRelations[]; nextCursor: string | null }> {
    const decoded = cursor ? decodeCursor<RecentCursor>(cursor) : null;
    const items = await this.prisma.review.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      include: reviewListInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async findVote(reviewId: string, userId: string, tx?: PrismaTransaction) {
    return this.client(tx).reviewVote.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    });
  }

  async upsertVote(reviewId: string, userId: string, useful: boolean, tx?: PrismaTransaction) {
    return this.client(tx).reviewVote.upsert({
      where: { userId_reviewId: { userId, reviewId } },
      create: { reviewId, userId, useful },
      update: { useful },
    });
  }

  async deleteVote(reviewId: string, userId: string, tx?: PrismaTransaction) {
    return this.client(tx).reviewVote.delete({
      where: { userId_reviewId: { userId, reviewId } },
    });
  }

  async findReport(reviewId: string, reporterId: string) {
    return this.prisma.reviewReport.findUnique({
      where: { reviewId_reporterId: { reviewId, reporterId } },
    });
  }

  async createReport(
    data: { reviewId: string; reporterId: string; reason: Prisma.ReviewReportCreateInput['reason']; details?: string },
    tx?: PrismaTransaction,
  ) {
    return this.client(tx).reviewReport.create({
      data: {
        reviewId: data.reviewId,
        reporterId: data.reporterId,
        reason: data.reason,
        details: data.details ?? null,
      },
    });
  }

  async viewerContext(reviewIds: string[], viewerId: string) {
    if (reviewIds.length === 0) {
      return { votes: new Map<string, boolean>(), reports: new Set<string>() };
    }

    const [votes, reports] = await Promise.all([
      this.prisma.reviewVote.findMany({
        where: { userId: viewerId, reviewId: { in: reviewIds } },
        select: { reviewId: true, useful: true },
      }),
      this.prisma.reviewReport.findMany({
        where: { reporterId: viewerId, reviewId: { in: reviewIds } },
        select: { reviewId: true },
      }),
    ]);

    return {
      votes: new Map(votes.map((vote) => [vote.reviewId, vote.useful])),
      reports: new Set(reports.map((report) => report.reviewId)),
    };
  }

  async countRecentByUser(userId: string, since: Date): Promise<number> {
    return this.prisma.review.count({
      where: { userId, createdAt: { gte: since }, deletedAt: null },
    });
  }

  async countRecentByFingerprint(fingerprint: string, since: Date, excludeUserId?: string): Promise<number> {
    return this.prisma.review.count({
      where: {
        textFingerprint: fingerprint,
        createdAt: { gte: since },
        deletedAt: null,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
    });
  }

  async countDistinctUsersByIp(ipHash: string, since: Date): Promise<number> {
    const rows = await this.prisma.review.findMany({
      where: { authorIpHash: ipHash, createdAt: { gte: since }, deletedAt: null },
      distinct: ['userId'],
      select: { userId: true },
    });
    return rows.length;
  }
}
