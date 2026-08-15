import { Injectable } from '@nestjs/common';
import { slugify, uniqueSlug, type PlatformFamily } from '@gamescore/shared';
import type { ImportGameResultDto } from '@gamescore/types';
import type { GameRelationKind } from '@prisma/client';

import { BadRequestError, NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GameRepository } from '../../games/repositories/game.repository';
import { CdnImageProvider } from '../images/image-provider';
import { IgdbClient, type IgdbGame } from '../igdb/igdb.client';

/** Cap per kind to avoid IGDB rate-limit spikes on titles with huge DLC catalogues. */
const MAX_RELATIONS_PER_KIND = 20;

const PLATFORM_FAMILY: Record<string, PlatformFamily> = {
  pc: 'PC',
  win: 'PC',
  mac: 'PC',
  linux: 'PC',
  ps5: 'PLAYSTATION',
  ps4: 'PLAYSTATION',
  ps3: 'PLAYSTATION',
  'ps2': 'PLAYSTATION',
  'ps vita': 'PLAYSTATION',
  psp: 'PLAYSTATION',
  'xbox series x|s': 'XBOX',
  'xbox series x': 'XBOX',
  'xbox one': 'XBOX',
  'xbox 360': 'XBOX',
  xbox: 'XBOX',
  switch: 'NINTENDO',
  'nintendo switch': 'NINTENDO',
  wiiu: 'NINTENDO',
  wii: 'NINTENDO',
  '3ds': 'NINTENDO',
  n64: 'NINTENDO',
  ios: 'MOBILE',
  android: 'MOBILE',
};

@Injectable()
export class GameImportService {
  private readonly images = new CdnImageProvider();

  constructor(
    private readonly igdb: IgdbClient,
    private readonly games: GameRepository,
    private readonly prisma: PrismaService,
  ) {}

  async importByExternalId(externalId: string): Promise<ImportGameResultDto> {
    const existing = await this.prisma.gameExternalSource.findUnique({
      where: { provider_externalId: { provider: 'IGDB', externalId } },
      include: { game: true },
    });
    if (existing) {
      return {
        gameId: existing.gameId,
        slug: existing.game.slug,
        name: existing.game.name,
        provider: 'IGDB',
        externalId,
        created: false,
        warnings: ['Game already imported'],
      };
    }

    const payload = await this.igdb.getGameById(externalId);
    if (!payload) {
      throw new NotFoundError(ERROR_CODES.IGDB_GAME_NOT_FOUND, 'IGDB game not found');
    }

    return this.persist(payload, true);
  }

  async importByName(name: string): Promise<ImportGameResultDto> {
    const matches = await this.igdb.searchByName(name);
    const payload = matches[0];
    if (!payload) {
      throw new NotFoundError(ERROR_CODES.IGDB_GAME_NOT_FOUND, 'No IGDB game matched that name');
    }
    return this.importByExternalId(String(payload.id));
  }

  async persist(payload: IgdbGame, createIfMissing: boolean): Promise<ImportGameResultDto> {
    const warnings: string[] = [];
    if (!payload.name?.trim()) {
      throw new BadRequestError(ERROR_CODES.IGDB_INVALID_PAYLOAD, 'IGDB game is missing a name');
    }

    const mapped = this.map(payload, warnings);
    const externalId = String(payload.id);

    const existingSource = await this.prisma.gameExternalSource.findUnique({
      where: { provider_externalId: { provider: 'IGDB', externalId } },
    });

    if (existingSource) {
      return {
        gameId: existingSource.gameId,
        slug: mapped.slug,
        name: mapped.name,
        provider: 'IGDB',
        externalId,
        created: false,
        warnings,
      };
    }

    if (!createIfMissing) {
      throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game has not been imported yet');
    }

    const slug = await this.allocateSlug(mapped.slug);
    const platformIds = await this.ensurePlatforms(payload.platforms ?? [], warnings);
    const genreIds = await this.ensureGenres(payload.genres ?? []);

    const game = await this.games.create({
      slug,
      name: mapped.name,
      summary: mapped.summary,
      description: mapped.description,
      developer: mapped.developer,
      publisher: mapped.publisher,
      releaseDate: mapped.releaseDate,
      coverImageUrl: mapped.coverImageUrl,
      bannerImageUrl: mapped.bannerImageUrl,
      platformIds,
      genreIds,
    });

    await this.prisma.gameExternalSource.create({
      data: {
        gameId: game.id,
        provider: 'IGDB',
        externalId,
        externalUpdatedAt: payload.updated_at ? new Date(payload.updated_at * 1000) : null,
        lastSyncedAt: new Date(),
        rawPayload: payload as object,
      },
    });

    // If this title was already listed as someone else's DLC/expansion, point those rows here.
    await this.prisma.gameRelation.updateMany({
      where: { provider: 'IGDB', externalId, relatedGameId: null },
      data: { relatedGameId: game.id },
    });

    await this.syncRelations(game.id, payload);

    return {
      gameId: game.id,
      slug: game.slug,
      name: game.name,
      provider: 'IGDB',
      externalId,
      created: true,
      warnings,
    };
  }

  /**
   * Upserts DLC / expansion metadata for a local game. Does not import child
   * games into the catalogue — only relation rows (and `relatedGameId` when
   * the child was already imported separately).
   */
  async syncRelations(gameId: string, payload: IgdbGame): Promise<void> {
    const dlcIds = (payload.dlcs ?? []).filter((id) => Number.isFinite(id)).slice(0, MAX_RELATIONS_PER_KIND);
    const expansionIds = (payload.expansions ?? [])
      .filter((id) => Number.isFinite(id))
      .slice(0, MAX_RELATIONS_PER_KIND);

    const allIds = [...new Set([...dlcIds, ...expansionIds])];
    const details = allIds.length > 0 ? await this.igdb.getGamesByIds(allIds) : [];
    const byId = new Map(details.map((row) => [row.id, row]));

    const externalIds = allIds.map(String);
    const sources =
      externalIds.length === 0
        ? []
        : await this.prisma.gameExternalSource.findMany({
            where: { provider: 'IGDB', externalId: { in: externalIds } },
            select: { externalId: true, gameId: true },
          });
    const localByExternal = new Map(sources.map((row) => [row.externalId, row.gameId]));

    type RelationRow = {
      kind: GameRelationKind;
      externalId: string;
      name: string;
      coverImageUrl: string | null;
      releaseDate: Date | null;
      relatedGameId: string | null;
    };

    const rows: RelationRow[] = [];
    const pushKind = (ids: number[], kind: GameRelationKind) => {
      for (const id of ids) {
        const detail = byId.get(id);
        if (!detail?.name?.trim()) continue;
        const externalId = String(id);
        rows.push({
          kind,
          externalId,
          name: detail.name.trim().slice(0, 255),
          coverImageUrl: this.images.coverUrl(detail.cover?.url ?? null),
          releaseDate: detail.first_release_date
            ? new Date(detail.first_release_date * 1000)
            : null,
          relatedGameId: localByExternal.get(externalId) ?? null,
        });
      }
    };
    pushKind(dlcIds, 'DLC');
    pushKind(expansionIds, 'EXPANSION');

    await this.prisma.$transaction(async (tx) => {
      await tx.gameRelation.deleteMany({
        where: {
          gameId,
          provider: 'IGDB',
          kind: { in: ['DLC', 'EXPANSION'] },
          ...(rows.length > 0
            ? {
                NOT: {
                  OR: rows.map((row) => ({
                    externalId: row.externalId,
                    kind: row.kind,
                  })),
                },
              }
            : {}),
        },
      });

      for (const row of rows) {
        await tx.gameRelation.upsert({
          where: {
            gameId_provider_externalId_kind: {
              gameId,
              provider: 'IGDB',
              externalId: row.externalId,
              kind: row.kind,
            },
          },
          create: {
            gameId,
            provider: 'IGDB',
            ...row,
          },
          update: {
            name: row.name,
            coverImageUrl: row.coverImageUrl,
            releaseDate: row.releaseDate,
            relatedGameId: row.relatedGameId,
          },
        });
      }
    });
  }

  map(payload: IgdbGame, warnings: string[]) {
    const developers =
      payload.involved_companies?.filter((company) => company.developer).map((c) => c.company?.name) ?? [];
    const publishers =
      payload.involved_companies?.filter((company) => company.publisher).map((c) => c.company?.name) ?? [];

    if (!payload.summary) warnings.push('Missing summary');
    if (!payload.cover?.url) warnings.push('Missing cover image');
    if (!payload.first_release_date) warnings.push('Missing release date');

    return {
      name: payload.name!.trim(),
      slug: slugify(payload.slug || payload.name || 'game'),
      summary: payload.summary?.slice(0, 600) ?? null,
      description: payload.storyline ?? payload.summary ?? null,
      developer: developers.filter(Boolean).join(', ') || null,
      publisher: publishers.filter(Boolean).join(', ') || null,
      releaseDate: payload.first_release_date
        ? new Date(payload.first_release_date * 1000)
        : null,
      coverImageUrl: this.images.coverUrl(payload.cover?.url ?? null),
      bannerImageUrl: this.images.bannerUrl(payload.screenshots?.[0]?.url ?? null),
    };
  }

  private async allocateSlug(preferred: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.game.findMany({
          where: { slug: { startsWith: preferred } },
          select: { slug: true },
        })
      ).map((row) => row.slug),
    );
    return uniqueSlug(preferred, (candidate) => taken.has(candidate));
  }

  private async ensurePlatforms(
    platforms: Array<{ name?: string; abbreviation?: string }>,
    warnings: string[],
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const platform of platforms) {
      if (!platform.name) continue;
      const slug = slugify(platform.abbreviation || platform.name);
      const family = this.familyFor(platform.name, platform.abbreviation);
      const row = await this.prisma.platform.upsert({
        where: { slug },
        create: {
          slug,
          name: platform.name,
          abbreviation: (platform.abbreviation || platform.name).slice(0, 20),
          family,
        },
        update: {},
      });
      ids.push(row.id);
    }
    if (ids.length === 0) warnings.push('No platforms mapped');
    return ids;
  }

  private async ensureGenres(genres: Array<{ name?: string }>): Promise<string[]> {
    const ids: string[] = [];
    for (const genre of genres) {
      if (!genre.name) continue;
      const slug = slugify(genre.name);
      const row = await this.prisma.genre.upsert({
        where: { slug },
        create: { slug, name: genre.name },
        update: {},
      });
      ids.push(row.id);
    }
    return ids;
  }

  private familyFor(name: string, abbreviation?: string): PlatformFamily {
    const haystack = `${abbreviation ?? ''} ${name}`.toLowerCase();
    for (const [key, family] of Object.entries(PLATFORM_FAMILY)) {
      if (haystack.includes(key)) return family;
    }
    return 'OTHER';
  }
}
