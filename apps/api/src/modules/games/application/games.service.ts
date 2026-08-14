import { Inject, Injectable } from '@nestjs/common';
import type { GameDetailDto, GameSummaryDto, GenreDto, PaginatedResponse, PlatformDto } from '@gamescore/types';

import { AppConfigService } from '../../../common/config/app-config.service';
import { NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { clampLimit, clampPage, paginated } from '../../../common/http/pagination';
import { JOB_NAMES } from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import type { AuthUser } from '../../auth/domain/auth-user';
import { toGameDetailDto, toGameSummaryDto, toGenreDto, toPlatformDto } from '../mappers/game.mapper';
import { GameRepository } from '../repositories/game.repository';
import type { ListGamesQueryDto } from '../dto/list-games.dto';

@Injectable()
export class GamesService {
  constructor(
    private readonly games: GameRepository,
    private readonly config: AppConfigService,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async list(query: ListGamesQueryDto): Promise<PaginatedResponse<GameSummaryDto>> {
    const page = clampPage(query.page);
    const limit = clampLimit(query.limit);
    const { items, total } = await this.games.list({
      platformSlug: query.platform,
      genreSlug: query.genre,
      sort: query.sort ?? 'POPULAR',
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginated(
      items.map((game) => toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews)),
      total,
      page,
      limit,
    );
  }

  async getBySlug(slug: string, viewer?: AuthUser | null): Promise<GameDetailDto> {
    const game = await this.games.findBySlug(slug);
    if (!game) {
      throw new NotFoundError(ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
    }

    const [viewerReviewId, hasReviewBombEvents] = await Promise.all([
      viewer ? this.games.findViewerReviewId(game.id, viewer.id) : Promise.resolve(null),
      this.games.hasOpenReviewBombEvents(game.id),
    ]);

    await this.jobs.enqueue(JOB_NAMES.RECORD_GAME_VIEW, { gameId: game.id });

    return toGameDetailDto(game, {
      viewerReviewId,
      hasReviewBombEvents,
      minimumReviewsForLabel: this.config.ranking.scoreLabelMinimumReviews,
    });
  }

  async listPlatforms(): Promise<PlatformDto[]> {
    const platforms = await this.games.listPlatforms();
    return platforms.map(toPlatformDto);
  }

  async listGenres(): Promise<GenreDto[]> {
    const genres = await this.games.listGenres();
    return genres.map(toGenreDto);
  }
}
