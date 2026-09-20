import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type {
  AccountExport,
  AuthenticatedUser,
  CursorPaginatedResponse,
  ReputationEventDto,
  ReviewDto,
  UserProfile,
  UserStatisticsDto,
  UserStatisticsRange,
} from '@gamescore/types';

import { Authenticated, OptionalAuth } from '../auth/decorators/auth.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/domain/auth-user';
import { UsersService } from './application/users.service';
import { UserStatisticsService } from './application/user-statistics.service';

class UserReviewsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

class UserStatisticsQueryDto {
  @IsOptional()
  @IsIn(['3m', '12m', 'all'])
  range?: UserStatisticsRange = 'all';
}

class ReputationEventsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

class UpdateProfileDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @Length(2, 50)
  displayName?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string | null;
}

class DeleteAccountDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly statistics: UserStatisticsService,
  ) {}

  @Get('me/export')
  @Authenticated()
  @ApiOperation({ summary: 'Download a copy of the signed-in players personal data' })
  @ApiOkResponse({ description: 'Portable JSON export' })
  exportMe(@CurrentUser() user: AuthUser): Promise<AccountExport> {
    return this.users.exportMe(user.id);
  }

  @Delete('me')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Anonymise the signed-in account. Reviews stay on games.' })
  deleteMe(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto): Promise<void> {
    return this.users.deleteMe(user.id, dto.password);
  }

  @Patch('me')
  @Authenticated()
  @ApiOperation({ summary: 'Update the signed-in profile' })
  @ApiOkResponse({ description: 'Updated account' })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    return this.users.updateMe(user.id, dto);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Public player profile' })
  @ApiOkResponse({ description: 'Profile' })
  getProfile(@Param('username') username: string): Promise<UserProfile> {
    return this.users.getProfile(username);
  }

  @Get(':username/statistics')
  @OptionalAuth()
  @ApiOperation({ summary: 'Public analytics for a player profile' })
  @ApiOkResponse({ description: 'Profile statistics' })
  getStatistics(
    @Param('username') username: string,
    @Query() query: UserStatisticsQueryDto,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<UserStatisticsDto> {
    return this.statistics.getStatistics(username, query.range ?? 'all', viewer);
  }

  @Get(':username/reputation-events')
  @OptionalAuth()
  @ApiOperation({ summary: 'Paginated reputation ledger for a player' })
  @ApiOkResponse({ description: 'Reputation events' })
  listReputationEvents(
    @Param('username') username: string,
    @Query() query: ReputationEventsQueryDto,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<CursorPaginatedResponse<ReputationEventDto>> {
    return this.statistics.listReputationEvents(username, query.cursor, query.limit, viewer);
  }

  @Get(':username/reviews')
  @OptionalAuth()
  @ApiOperation({ summary: 'Reviews written by this player' })
  @ApiOkResponse({ description: 'Review page' })
  listReviews(
    @Param('username') username: string,
    @Query() query: UserReviewsQueryDto,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<CursorPaginatedResponse<ReviewDto>> {
    return this.users.listReviews(username, query.cursor, query.limit, viewer);
  }
}
