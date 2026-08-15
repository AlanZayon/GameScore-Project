import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { AuthenticatedUser, CursorPaginatedResponse, ReviewDto, UserProfile } from '@gamescore/types';

import { Authenticated, OptionalAuth } from '../auth/decorators/auth.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/domain/auth-user';
import { UsersService } from './application/users.service';

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

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
