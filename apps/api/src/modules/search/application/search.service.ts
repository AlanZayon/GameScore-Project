import { Inject, Injectable } from '@nestjs/common';
import type { AutocompleteItemDto, SearchResultDto } from '@gamescore/types';

import { AppConfigService } from '../../../common/config/app-config.service';
import { clampLimit, clampPage } from '../../../common/http/pagination';
import { toGameSummaryDto } from '../../games/mappers/game.mapper';
import { GameRepository } from '../../games/repositories/game.repository';
import { SEARCH_PROVIDER, type SearchProvider } from '../providers/search-provider';

@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_PROVIDER) private readonly provider: SearchProvider,
    private readonly games: GameRepository,
    private readonly config: AppConfigService,
  ) {}

  async search(input: {
    q: string;
    page?: number;
    limit?: number;
    platformSlug?: string;
    genreSlug?: string;
  }): Promise<SearchResultDto> {
    const page = clampPage(input.page);
    const limit = clampLimit(input.limit);
    const hits = await this.provider.search({
      q: input.q,
      page,
      limit,
      platformSlug: input.platformSlug,
      genreSlug: input.genreSlug,
    });

    const games = await Promise.all(hits.items.map((hit) => this.games.findById(hit.gameId)));
    const items = games
      .filter((game): game is NonNullable<typeof game> => game !== null)
      .map((game) => toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews));

    return {
      query: input.q,
      items,
      total: hits.total,
      page,
      limit,
      totalPages: hits.total === 0 ? 0 : Math.ceil(hits.total / limit),
      provider: this.provider.name,
      tookMs: hits.tookMs,
    };
  }

  async autocomplete(q: string, limit = 8): Promise<AutocompleteItemDto[]> {
    return this.provider.autocomplete(q, Math.min(20, Math.max(1, limit)));
  }
}
