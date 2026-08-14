import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GameDetailDto, GameSummaryDto, GenreDto, PaginatedResponse, PlatformDto } from '@gamescore/types';

import { OptionalAuth } from '../auth/decorators/auth.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/domain/auth-user';
import { GamesService } from './application/games.service';
import { ListGamesQueryDto } from './dto/list-games.dto';

@ApiTags('games')
@Controller()
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('games')
  @ApiOperation({ summary: 'Paginated catalogue with optional platform/genre filters' })
  @ApiOkResponse({ description: 'Catalogue page' })
  async list(@Query() query: ListGamesQueryDto): Promise<PaginatedResponse<GameSummaryDto>> {
    return this.games.list(query);
  }

  @Get('games/:slug')
  @OptionalAuth()
  @ApiOperation({ summary: 'Game detail by slug' })
  @ApiOkResponse({ description: 'Game' })
  async getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<GameDetailDto> {
    return this.games.getBySlug(slug, viewer);
  }

  @Get('platforms')
  @ApiOperation({ summary: 'All platforms' })
  @ApiOkResponse({ description: 'Platform list' })
  async platforms(): Promise<PlatformDto[]> {
    return this.games.listPlatforms();
  }

  @Get('genres')
  @ApiOperation({ summary: 'All genres' })
  @ApiOkResponse({ description: 'Genre list' })
  async genres(): Promise<GenreDto[]> {
    return this.games.listGenres();
  }
}
