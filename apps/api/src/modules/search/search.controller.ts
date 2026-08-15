import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  AutocompleteItemDto,
  ExternalGamePreviewDto,
  ImportGameResultDto,
  SearchResultDto,
} from '@gamescore/types';

import { SearchService } from './application/search.service';
import {
  AutocompleteQueryDto,
  ImportExternalGameDto,
  SearchGamesQueryDto,
} from './dto/search.dto';

@ApiTags('games')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text catalogue search (local first, IGDB fallback when thin)' })
  @ApiOkResponse({ description: 'Search results' })
  async searchGames(@Query() query: SearchGamesQueryDto): Promise<SearchResultDto> {
    return this.search.search({
      q: query.q,
      page: query.page,
      limit: query.limit,
      platformSlug: query.platform,
      genreSlug: query.genre,
    });
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Prefix and typo-tolerant game suggestions' })
  @ApiOkResponse({ description: 'Autocomplete suggestions' })
  async autocomplete(@Query() query: AutocompleteQueryDto): Promise<AutocompleteItemDto[]> {
    return this.search.autocomplete(query.q, query.limit);
  }

  @Get('external/:externalId')
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Preview an IGDB game without importing it' })
  @ApiOkResponse({ description: 'External game preview' })
  async previewExternal(@Param('externalId') externalId: string): Promise<ExternalGamePreviewDto> {
    return this.search.previewExternal(externalId);
  }

  @Post('import')
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  @ApiOperation({
    summary: 'Import a game from IGDB (admin/tooling; public flow imports on first review)',
  })
  @ApiOkResponse({ description: 'Imported or already-local game' })
  async importExternal(@Body() body: ImportExternalGameDto): Promise<ImportGameResultDto> {
    return this.search.importExternal(body.externalId);
  }
}
