import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  REVIEW_BOMB_STATUSES,
  REVIEW_MODERATION_STATUSES,
  USER_ROLES,
  USER_STATUSES,
  type ReportStatus,
  type ReviewBombStatus,
  type ReviewModerationStatus,
  type UserRole,
  type UserStatus,
} from '@gamescore/shared';
import {
  IsArray,
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

export class AdminPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ImportGameDto {
  @ApiProperty({ example: '1942' })
  @IsString()
  @Length(1, 40)
  externalId!: string;
}

export class ImportGameByNameDto {
  @ApiProperty({ example: 'The Witcher 3' })
  @IsString()
  @Length(2, 120)
  name!: string;
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  developer?: string | null;

  @IsOptional()
  @IsString()
  publisher?: string | null;

  @IsOptional()
  @IsString()
  releaseDate?: string | null;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  bannerImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  platformIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  genreIds?: string[];
}

export class ModerateReviewDto {
  @ApiProperty()
  @IsString()
  @Length(2, 500)
  reason!: string;

  @ApiPropertyOptional({ enum: REVIEW_MODERATION_STATUSES })
  @IsOptional()
  @IsEnum(REVIEW_MODERATION_STATUSES)
  moderationStatus?: ReviewModerationStatus;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ['RESOLVED', 'DISMISSED'] })
  @IsEnum(['RESOLVED', 'DISMISSED'])
  status!: Extract<ReportStatus, 'RESOLVED' | 'DISMISSED'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class UpdateReviewBombDto {
  @ApiProperty({ enum: REVIEW_BOMB_STATUSES })
  @IsEnum(REVIEW_BOMB_STATUSES)
  status!: ReviewBombStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsEnum(USER_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suspendedUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 500)
  reason?: string;
}
