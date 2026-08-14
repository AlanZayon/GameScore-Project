import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SearchGamesQueryDto {
  @ApiProperty({ example: 'elden ring', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  q!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;
}

export class AutocompleteQueryDto {
  @ApiProperty({ example: 'zel', minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  q!: string;

  @ApiPropertyOptional({ default: 8, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 8;
}
