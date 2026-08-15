import { Injectable } from '@nestjs/common';
import type { ImportGameResultDto } from '@gamescore/types';

import { NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GameRepository } from '../../games/repositories/game.repository';
import { IgdbClient } from '../igdb/igdb.client';
import { GameImportService } from './game-import.service';

/**
 * Re-applies IGDB data to an existing game, skipping any field a human has
 * edited. That is what `Game.editedFields` is for.
 */
@Injectable()
export class GameSyncService {
  constructor(
    private readonly igdb: IgdbClient,
    private readonly importer: GameImportService,
    private readonly games: GameRepository,
    private readonly prisma: PrismaService,
  ) {}

  async sync(gameId: string): Promise<ImportGameResultDto> {
    const game = await this.games.findById(gameId);
    if (!game) throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game not found');

    const source = await this.prisma.gameExternalSource.findFirst({
      where: { gameId, provider: 'IGDB' },
    });
    if (!source) {
      throw new NotFoundError(ERROR_CODES.IGDB_GAME_NOT_FOUND, 'This game has no IGDB source');
    }

    const payload = await this.igdb.getGameById(source.externalId);
    if (!payload) {
      throw new NotFoundError(ERROR_CODES.IGDB_GAME_NOT_FOUND, 'IGDB game not found');
    }

    const warnings: string[] = [];
    const mapped = this.importer.map(payload, warnings);
    const edited = new Set(game.editedFields);

    const next = {
      name: edited.has('name') ? game.name : mapped.name,
      summary: edited.has('summary') ? game.summary : mapped.summary,
      description: edited.has('description') ? game.description : mapped.description,
      developer: edited.has('developer') ? game.developer : mapped.developer,
      publisher: edited.has('publisher') ? game.publisher : mapped.publisher,
      releaseDate: edited.has('releaseDate') ? game.releaseDate : mapped.releaseDate,
      coverImageUrl: edited.has('coverImageUrl') ? game.coverImageUrl : mapped.coverImageUrl,
      bannerImageUrl: edited.has('bannerImageUrl') ? game.bannerImageUrl : mapped.bannerImageUrl,
      trailerYoutubeId: edited.has('trailerYoutubeId') ? game.trailerYoutubeId : mapped.trailerYoutubeId,
      galleryImageUrls: edited.has('galleryImageUrls') ? game.galleryImageUrls : mapped.galleryImageUrls,
      editedFields: game.editedFields,
    };

    await this.games.updateEditorial(gameId, next);
    await this.prisma.gameExternalSource.update({
      where: { id: source.id },
      data: {
        lastSyncedAt: new Date(),
        externalUpdatedAt: payload.updated_at ? new Date(payload.updated_at * 1000) : source.externalUpdatedAt,
        rawPayload: payload as object,
      },
    });
    await this.importer.syncRelations(gameId, payload);

    return {
      gameId,
      slug: game.slug,
      name: next.name,
      provider: 'IGDB',
      externalId: source.externalId,
      created: false,
      warnings,
    };
  }
}
