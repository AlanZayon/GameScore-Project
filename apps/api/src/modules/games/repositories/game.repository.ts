import { Injectable } from '@nestjs/common';
import type { GameSort } from '@gamescore/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService, type PrismaTransaction } from '../../../common/prisma/prisma.service';
import type { GameWithRelations } from '../mappers/game.mapper';

export const gameCardInclude = {
  platforms: { include: { platform: true } },
  genres: { include: { genre: true } },
  statistics: true,
} satisfies Prisma.GameInclude;

export const gameDetailInclude = {
  ...gameCardInclude,
  relations: {
    where: { kind: { in: ['DLC', 'EXPANSION'] } },
    include: { relatedGame: { select: { slug: true } } },
    orderBy: [{ kind: 'asc' as const }, { name: 'asc' as const }],
  },
} satisfies Prisma.GameInclude;

export interface ListGamesFilters {
  platformSlug?: string;
  genreSlug?: string;
  sort: GameSort;
  skip: number;
  take: number;
}

export interface CreateGameData {
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  developer?: string | null;
  publisher?: string | null;
  releaseDate?: Date | null;
  coverImageUrl?: string | null;
  bannerImageUrl?: string | null;
  trailerYoutubeId?: string | null;
  galleryImageUrls?: string[];
  platformIds?: string[];
  genreIds?: string[];
  editedFields?: string[];
}

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: PrismaTransaction): PrismaTransaction {
    return tx ?? this.prisma;
  }

  async findById(id: string, tx?: PrismaTransaction): Promise<GameWithRelations | null> {
    return this.client(tx).game.findUnique({
      where: { id },
      include: gameCardInclude,
    });
  }

  async findManyByIds(ids: string[]): Promise<GameWithRelations[]> {
    if (ids.length === 0) return [];
    return this.prisma.game.findMany({
      where: { id: { in: ids } },
      include: gameCardInclude,
    });
  }

  async findBySlug(slug: string, tx?: PrismaTransaction): Promise<GameWithRelations | null> {
    return this.client(tx).game.findUnique({
      where: { slug },
      include: gameDetailInclude,
    });
  }

  async slugExists(slug: string, tx?: PrismaTransaction): Promise<boolean> {
    const found = await this.client(tx).game.findUnique({
      where: { slug },
      select: { id: true },
    });
    return found !== null;
  }

  async list(filters: ListGamesFilters): Promise<{ items: GameWithRelations[]; total: number }> {
    const where: Prisma.GameWhereInput = {};

    if (filters.platformSlug) {
      where.platforms = { some: { platform: { slug: filters.platformSlug } } };
    }
    if (filters.genreSlug) {
      where.genres = { some: { genre: { slug: filters.genreSlug } } };
    }

    const orderBy = this.orderBy(filters.sort);

    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        include: gameCardInclude,
        orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.game.count({ where }),
    ]);

    return { items, total };
  }

  async listPlatforms() {
    return this.prisma.platform.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async listGenres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }

  async findPlatformById(id: string) {
    return this.prisma.platform.findUnique({ where: { id } });
  }

  async findPlatformsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.platform.findMany({ where: { id: { in: ids } } });
  }

  async findGenresByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.genre.findMany({ where: { id: { in: ids } } });
  }

  async create(data: CreateGameData, tx?: PrismaTransaction): Promise<GameWithRelations> {
    const db = this.client(tx);
    return db.game.create({
      data: {
        slug: data.slug,
        name: data.name,
        summary: data.summary ?? null,
        description: data.description ?? null,
        developer: data.developer ?? null,
        publisher: data.publisher ?? null,
        releaseDate: data.releaseDate ?? null,
        coverImageUrl: data.coverImageUrl ?? null,
        bannerImageUrl: data.bannerImageUrl ?? null,
        trailerYoutubeId: data.trailerYoutubeId ?? null,
        galleryImageUrls: data.galleryImageUrls ?? [],
        editedFields: data.editedFields ?? [],
        platforms: data.platformIds
          ? { create: data.platformIds.map((platformId) => ({ platformId })) }
          : undefined,
        genres: data.genreIds ? { create: data.genreIds.map((genreId) => ({ genreId })) } : undefined,
        statistics: { create: {} },
      },
      include: gameCardInclude,
    });
  }

  async updateEditorial(
    id: string,
    data: {
      name?: string;
      summary?: string | null;
      description?: string | null;
      developer?: string | null;
      publisher?: string | null;
      releaseDate?: Date | null;
      coverImageUrl?: string | null;
      bannerImageUrl?: string | null;
      trailerYoutubeId?: string | null;
      galleryImageUrls?: string[];
      platformIds?: string[];
      genreIds?: string[];
      editedFields: string[];
    },
    tx?: PrismaTransaction,
  ): Promise<GameWithRelations> {
    const db = this.client(tx);

    if (data.platformIds) {
      await db.gamePlatform.deleteMany({ where: { gameId: id } });
      if (data.platformIds.length > 0) {
        await db.gamePlatform.createMany({
          data: data.platformIds.map((platformId) => ({ gameId: id, platformId })),
        });
      }
    }

    if (data.genreIds) {
      await db.gameGenre.deleteMany({ where: { gameId: id } });
      if (data.genreIds.length > 0) {
        await db.gameGenre.createMany({
          data: data.genreIds.map((genreId) => ({ gameId: id, genreId })),
        });
      }
    }

    return db.game.update({
      where: { id },
      data: {
        name: data.name,
        summary: data.summary,
        description: data.description,
        developer: data.developer,
        publisher: data.publisher,
        releaseDate: data.releaseDate,
        coverImageUrl: data.coverImageUrl,
        bannerImageUrl: data.bannerImageUrl,
        trailerYoutubeId: data.trailerYoutubeId,
        galleryImageUrls: data.galleryImageUrls,
        editedFields: data.editedFields,
      },
      include: gameCardInclude,
    });
  }

  async incrementViewCount(gameId: string, date: Date, tx?: PrismaTransaction): Promise<void> {
    const db = this.client(tx);
    await db.game.update({
      where: { id: gameId },
      data: { viewCount: { increment: 1 } },
    });
    await db.gameActivityDaily.upsert({
      where: { gameId_date: { gameId, date } },
      create: { gameId, date, viewCount: 1 },
      update: { viewCount: { increment: 1 } },
    });
  }

  async countAll(): Promise<number> {
    return this.prisma.game.count();
  }

  async findViewerReviewId(gameId: string, userId: string): Promise<string | null> {
    const review = await this.prisma.review.findFirst({
      where: { gameId, userId, deletedAt: null },
      select: { id: true },
    });
    return review?.id ?? null;
  }

  async hasOpenReviewBombEvents(gameId: string): Promise<boolean> {
    const count = await this.prisma.reviewBombEvent.count({
      where: { gameId, status: { in: ['DETECTED', 'CONFIRMED'] } },
    });
    return count > 0;
  }

  private orderBy(sort: GameSort): Prisma.GameOrderByWithRelationInput[] {
    switch (sort) {
      case 'TOP_RATED':
        return [
          { statistics: { confidenceScore: 'desc' } },
          { statistics: { totalReviews: 'desc' } },
          { name: 'asc' },
        ];
      case 'RECENT':
        return [{ releaseDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
      case 'NAME':
        return [{ name: 'asc' }];
      case 'RELEVANCE':
      case 'POPULAR':
      default:
        return [
          { statistics: { totalReviews: 'desc' } },
          { viewCount: 'desc' },
          { name: 'asc' },
        ];
    }
  }
}
