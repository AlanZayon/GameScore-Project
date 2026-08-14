import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { HomeFeedDto, RankingResponseDto } from '@gamescore/types';

import { RankingsService } from './application/rankings.service';

class RankingLimitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 25;
}

@ApiTags('rankings')
@Controller()
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get('home')
  @ApiOperation({ summary: 'Home feed: popular, top rated, new releases, trending' })
  @ApiOkResponse({ description: 'Home feed' })
  home(): Promise<HomeFeedDto> {
    return this.rankings.home();
  }

  @Get('rankings/top-rated')
  @ApiOperation({ summary: 'Top rated games ordered by Wilson confidence score' })
  @ApiOkResponse({ description: 'Top rated ranking' })
  topRated(@Query() query: RankingLimitDto): Promise<RankingResponseDto> {
    return this.rankings.topRated(query.limit);
  }

  @Get('rankings/trending')
  @ApiOperation({ summary: 'Games with the most recent review and view growth' })
  @ApiOkResponse({ description: 'Trending ranking' })
  trending(@Query() query: RankingLimitDto): Promise<RankingResponseDto> {
    return this.rankings.trending(query.limit);
  }

  @Get('rankings/new-releases')
  @ApiOperation({ summary: 'Most recently released games' })
  @ApiOkResponse({ description: 'New releases ranking' })
  newReleases(@Query() query: RankingLimitDto): Promise<RankingResponseDto> {
    return this.rankings.newReleases(query.limit);
  }

  @Get('rankings/popular')
  @ApiOperation({ summary: 'Games with the most reviews' })
  @ApiOkResponse({ description: 'Popular ranking' })
  popular(@Query() query: RankingLimitDto): Promise<RankingResponseDto> {
    return this.rankings.popular(query.limit);
  }
}
