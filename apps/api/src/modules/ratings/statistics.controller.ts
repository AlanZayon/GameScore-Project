import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GameStatisticsDto } from '@gamescore/types';

import { StatisticsService } from '../ratings/application/statistics.service';

@ApiTags('games')
@Controller('games')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get(':slug/statistics')
  @ApiOperation({ summary: 'Derived score, per-platform breakdown and review timeline' })
  @ApiOkResponse({ description: 'Game statistics' })
  async get(@Param('slug') slug: string): Promise<GameStatisticsDto> {
    return this.statistics.getBySlug(slug);
  }
}
