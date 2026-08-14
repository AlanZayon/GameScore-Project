import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GAME_SORTS, type GameSort } from '@gamescore/shared';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListGamesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by platform slug' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: 'Filter by genre slug' })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ enum: GAME_SORTS, default: 'POPULAR' })
  @IsOptional()
  @IsEnum(GAME_SORTS)
  sort?: GameSort = 'POPULAR';
}
