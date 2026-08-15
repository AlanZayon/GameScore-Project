import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AutocompleteItemDto,
  ExternalGameHitDto,
  ExternalGamePreviewDto,
  ImportGameResultDto,
  SearchHitSource,
  SearchResultDto,
} from '@gamescore/types';

import { CacheService } from '../../../common/cache/cache.service';
import { AppConfigService } from '../../../common/config/app-config.service';
import { NotFoundError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { clampLimit, clampPage } from '../../../common/http/pagination';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toGameSummaryDto } from '../../games/mappers/game.mapper';
import { GameRepository } from '../../games/repositories/game.repository';
import { GameImportService } from '../../integrations/application/game-import.service';
import { CdnImageProvider } from '../../integrations/images/image-provider';
import { IgdbClient } from '../../integrations/igdb/igdb.client';
import { SEARCH_PROVIDER, type SearchProvider } from '../providers/search-provider';

/** When local catalogue matches fall below this, fill from IGDB on page 1. */
const LOCAL_THIN_THRESHOLD = 3;
const IGDB_SEARCH_LIMIT = 12;
const IGDB_AUTOCOMPLETE_MIN_CHARS = 3;
const IGDB_CACHE_TTL_SECONDS = 120;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly images = new CdnImageProvider();

  constructor(
    @Inject(SEARCH_PROVIDER) private readonly provider: SearchProvider,
    private readonly games: GameRepository,
    private readonly config: AppConfigService,
    private readonly igdb: IgdbClient,
    private readonly importer: GameImportService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async search(input: {
    q: string;
    page?: number;
    limit?: number;
    platformSlug?: string;
    genreSlug?: string;
  }): Promise<SearchResultDto> {
    const started = Date.now();
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

    const sources: SearchHitSource[] = ['local'];
    let externalItems: ExternalGameHitDto[] = [];

    const shouldQueryIgdb =
      this.igdb.configured &&
      !input.platformSlug &&
      !input.genreSlug &&
      page === 1 &&
      items.length < LOCAL_THIN_THRESHOLD;

    if (shouldQueryIgdb) {
      externalItems = await this.fetchExternalHits(input.q, IGDB_SEARCH_LIMIT);
      if (externalItems.length > 0) {
        sources.push('igdb');
      }
    }

    return {
      query: input.q,
      items,
      externalItems,
      total: hits.total,
      page,
      limit,
      totalPages: hits.total === 0 ? 0 : Math.ceil(hits.total / limit),
      provider: this.provider.name,
      sources,
      tookMs: Date.now() - started,
    };
  }

  async autocomplete(q: string, limit = 8): Promise<AutocompleteItemDto[]> {
    const capped = Math.min(20, Math.max(1, limit));
    const local = await this.provider.autocomplete(q, capped);

    if (
      !this.igdb.configured ||
      local.length >= capped ||
      q.trim().length < IGDB_AUTOCOMPLETE_MIN_CHARS
    ) {
      return local;
    }

    const remaining = capped - local.length;
    const external = await this.fetchExternalHits(q, remaining + 4);
    const localNames = new Set(local.map((item) => item.name.toLowerCase()));

    const extras: AutocompleteItemDto[] = external
      .filter((hit) => !localNames.has(hit.name.toLowerCase()))
      .slice(0, remaining)
      .map((hit) => ({
        id: `igdb:${hit.externalId}`,
        slug: null,
        name: hit.name,
        coverImageUrl: hit.coverImageUrl,
        releaseYear: hit.releaseYear,
        positivePercentage: null,
        totalReviews: 0,
        source: 'igdb',
        externalId: hit.externalId,
      }));

    return [...local, ...extras];
  }

  /** Kept for admin/tooling; public catalogue growth imports on first review instead. */
  async importExternal(externalId: string): Promise<ImportGameResultDto> {
    return this.importer.importByExternalId(externalId);
  }

  async previewExternal(externalId: string): Promise<ExternalGamePreviewDto> {
    const existing = await this.prisma.gameExternalSource.findUnique({
      where: { provider_externalId: { provider: 'IGDB', externalId } },
      include: { game: true },
    });
    if (existing) {
      return {
        externalId,
        provider: 'IGDB',
        name: existing.game.name,
        summary: existing.game.summary,
        description: existing.game.description,
        coverImageUrl: existing.game.coverImageUrl,
        bannerImageUrl: existing.game.bannerImageUrl,
        releaseDate: existing.game.releaseDate?.toISOString() ?? null,
        developer: existing.game.developer,
        publisher: existing.game.publisher,
        platforms: [],
        genres: [],
        localSlug: existing.game.slug,
      };
    }

    const payload = await this.igdb.getGameById(externalId);
    if (!payload?.name?.trim()) {
      throw new NotFoundError(ERROR_CODES.IGDB_GAME_NOT_FOUND, 'IGDB game not found');
    }

    const mapped = this.importer.map(payload, []);
    return {
      externalId,
      provider: 'IGDB',
      name: mapped.name,
      summary: mapped.summary,
      description: mapped.description,
      coverImageUrl: mapped.coverImageUrl,
      bannerImageUrl: mapped.bannerImageUrl,
      releaseDate: mapped.releaseDate?.toISOString() ?? null,
      developer: mapped.developer,
      publisher: mapped.publisher,
      platforms: (payload.platforms ?? [])
        .filter((platform) => platform.name)
        .map((platform) => ({
          name: platform.name!,
          abbreviation: (platform.abbreviation || platform.name!).slice(0, 20),
        })),
      genres: (payload.genres ?? [])
        .filter((genre) => genre.name)
        .map((genre) => ({ name: genre.name! })),
      localSlug: null,
    };
  }

  private async fetchExternalHits(q: string, limit: number): Promise<ExternalGameHitDto[]> {
    const term = q.trim();
    if (term.length < 2 || !this.igdb.configured) {
      return [];
    }

    const cacheKey = `igdb:search:${term.toLowerCase()}:${limit}`;
    const cached = await this.cache.get<ExternalGameHitDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const matches = await this.igdb.searchByName(term, limit);
      const ids = matches.map((match) => String(match.id));
      const existing =
        ids.length === 0
          ? []
          : await this.prisma.gameExternalSource.findMany({
              where: { provider: 'IGDB', externalId: { in: ids } },
              select: { externalId: true },
            });
      const imported = new Set(existing.map((row) => row.externalId));

      const hits: ExternalGameHitDto[] = matches
        .filter((match) => match.name && !imported.has(String(match.id)))
        .map((match) => ({
          externalId: String(match.id),
          provider: 'IGDB',
          name: match.name!.trim(),
          coverImageUrl: this.images.coverUrl(match.cover?.url),
          releaseYear: match.first_release_date
            ? new Date(match.first_release_date * 1000).getUTCFullYear()
            : null,
          summary: match.summary?.slice(0, 220) ?? null,
        }));

      await this.cache.set(cacheKey, hits, IGDB_CACHE_TTL_SECONDS);
      return hits.slice(0, limit);
    } catch (error) {
      this.logger.warn(
        `IGDB search fallback failed for "${term}": ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return [];
    }
  }
}
