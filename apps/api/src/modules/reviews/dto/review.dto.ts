import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  REPORT_REASONS,
  REVIEW_RECOMMENDATION_FILTERS,
  REVIEW_SORTS,
  type ReportReason,
  type ReviewRecommendationFilter,
  type ReviewSort,
} from '@gamescore/shared';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty()
  @IsBoolean()
  recommended!: boolean;

  @ApiProperty({ minLength: 20, maxLength: 8000 })
  @IsString()
  @Length(20, 8000)
  text!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 10, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  rating?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  hoursPlayed?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  platformId?: string | null;
}

export class UpdateReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @ApiPropertyOptional({ minLength: 20, maxLength: 8000 })
  @IsOptional()
  @IsString()
  @Length(20, 8000)
  text?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  rating?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  hoursPlayed?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  platformId?: string | null;
}

export class ListReviewsQueryDto {
  @ApiPropertyOptional({ enum: REVIEW_SORTS, default: 'BEST' })
  @IsOptional()
  @IsEnum(REVIEW_SORTS)
  sort?: ReviewSort = 'BEST';

  @ApiPropertyOptional({ enum: REVIEW_RECOMMENDATION_FILTERS, default: 'ALL' })
  @IsOptional()
  @IsEnum(REVIEW_RECOMMENDATION_FILTERS)
  recommendation?: ReviewRecommendationFilter = 'ALL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  platformId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minHoursPlayed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxHoursPlayed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class VoteReviewDto {
  @ApiProperty()
  @IsBoolean()
  useful!: boolean;
}

export class ReportReviewDto {
  @ApiProperty({ enum: REPORT_REASONS })
  @IsEnum(REPORT_REASONS)
  reason!: ReportReason;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  details?: string;
}

export class DeleteReviewDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
