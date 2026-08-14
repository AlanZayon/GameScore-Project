import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AutocompleteItemDto, SearchResultDto } from '@gamescore/types';

import { SearchService } from './application/search.service';
import { AutocompleteQueryDto, SearchGamesQueryDto } from './dto/search.dto';

@ApiTags('games')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text catalogue search' })
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
}
