import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import type {
  AccountExport,
  AuthenticatedUser,
  CursorPaginatedResponse,
  ReviewDto,
  UpdateProfileRequest,
  UserProfile,
} from '@gamescore/types';

import { clampLimit, cursorMeta, DEFAULT_CURSOR_SIZE } from '../../../common/http/pagination';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toAuthenticatedUser, toUserProfile } from '../mappers/user.mapper';
import { UserRepository } from '../repositories/user.repository';
import { ReviewRepository } from '../../reviews/repositories/review.repository';
import { toReviewDto } from '../../reviews/mappers/review.mapper';
import type { AuthUser } from '../../auth/domain/auth-user';

const ARGON = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

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

  async updateMe(userId: string, input: UpdateProfileRequest): Promise<AuthenticatedUser> {
    const displayName =
      input.displayName === undefined ? undefined : emptyToNull(input.displayName);
    const bio = input.bio === undefined ? undefined : emptyToNull(input.bio);
    const avatarUrl =
      input.avatarUrl === undefined ? undefined : this.normaliseAvatarUrl(input.avatarUrl);

    const updated = await this.users.updateProfile(userId, { displayName, bio, avatarUrl });
    return toAuthenticatedUser(updated);
  }

  async exportMe(userId: string): Promise<AccountExport> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'Account not found');
    }

    const [reviews, votes, reports, reputationEvents] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        include: { game: { select: { slug: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reviewVote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reviewReport.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reputationEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        reputationScore: user.reputationScore,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerifiedAt !== null,
        termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      reviews: reviews.map((review) => ({
        id: review.id,
        gameId: review.gameId,
        gameSlug: review.game.slug,
        gameName: review.game.name,
        recommended: review.recommended,
        rating: review.rating,
        text: review.text,
        hoursPlayed: review.hoursPlayed,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        status: review.status,
      })),
      votes: votes.map((vote) => ({
        reviewId: vote.reviewId,
        useful: vote.useful,
        createdAt: vote.createdAt.toISOString(),
      })),
      reports: reports.map((report) => ({
        id: report.id,
        reviewId: report.reviewId,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      })),
      reputationEvents: reputationEvents.map((event) => ({
        id: event.id,
        reason: event.reason,
        delta: event.delta,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async deleteMe(userId: string, password: string): Promise<void> {
    const user = await this.users.findCredentialsById(userId);
    if (!user) {
      throw new NotFoundError(ERROR_CODES.USER_NOT_FOUND, 'Account not found');
    }

    let passwordMatches = false;
    try {
      passwordMatches = await verify(user.passwordHash, password, ARGON);
    } catch {
      passwordMatches = false;
    }
    if (!passwordMatches) {
      throw new UnauthorizedError(ERROR_CODES.CURRENT_PASSWORD_INVALID, 'Current password is wrong');
    }

    const shortId = user.id.replaceAll('-', '').slice(0, 8);
    const passwordHash = await hash(randomBytes(32).toString('hex'), ARGON);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: now,
          email: `deleted+${user.id}@invalid.local`,
          username: `deleted_${shortId}`,
          displayName: null,
          bio: null,
          avatarUrl: null,
          passwordHash,
          emailVerifiedAt: null,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
    });
  }

  private normaliseAvatarUrl(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') {
        throw new BadRequestError(ERROR_CODES.INVALID_AVATAR_URL, 'Avatar URL must be https');
      }
      return parsed.toString();
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError(ERROR_CODES.INVALID_AVATAR_URL, 'Avatar URL is not valid');
    }
  }
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}
