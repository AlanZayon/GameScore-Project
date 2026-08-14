import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { CursorPaginatedResponse, ReviewDto, UserProfile } from '@gamescore/types';

import { OptionalAuth } from '../auth/decorators/auth.decorators';
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

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
