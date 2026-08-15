import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CursorPaginatedResponse, ReviewDto, ReviewVoteResponse } from '@gamescore/types';
import type { Request } from 'express';

import { Authenticated, OptionalAuth } from '../auth/decorators/auth.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/domain/auth-user';
import { ReviewsService } from './application/reviews.service';
import {
  CreateReviewDto,
  DeleteReviewDto,
  ListReviewsQueryDto,
  ReportReviewDto,
  UpdateReviewDto,
  VoteReviewDto,
} from './dto/review.dto';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('games/:slug/reviews')
  @OptionalAuth()
  @ApiOperation({ summary: 'Cursor-paginated reviews for a game' })
  @ApiOkResponse({ description: 'Review page' })
  async listForGame(
    @Param('slug') slug: string,
    @Query() query: ListReviewsQueryDto,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<CursorPaginatedResponse<ReviewDto>> {
    return this.reviews.listForGame(slug, query, viewer);
  }

  @Post('games/:slug/reviews')
  @Authenticated()
  @ApiOperation({ summary: 'Publish a review for a game' })
  @ApiCreatedResponse({ description: 'Review created' })
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ): Promise<ReviewDto> {
    return this.reviews.create(slug, dto, user, request.ip);
  }

  @Post('games/external/:externalId/reviews')
  @Authenticated()
  @ApiOperation({
    summary: 'Import an IGDB game (if needed) and publish the first review in one step',
  })
  @ApiCreatedResponse({ description: 'Review created after on-demand import' })
  async createForExternal(
    @Param('externalId') externalId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ): Promise<ReviewDto> {
    return this.reviews.createForExternal(externalId, dto, user, request.ip);
  }

  @Get('reviews/:id')
  @OptionalAuth()
  @ApiOperation({ summary: 'Single review' })
  @ApiOkResponse({ description: 'Review' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<ReviewDto> {
    return this.reviews.getById(id, viewer);
  }

  @Patch('reviews/:id')
  @Authenticated()
  @ApiOperation({ summary: 'Edit your own review' })
  @ApiOkResponse({ description: 'Updated review' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewDto> {
    return this.reviews.update(id, dto, user);
  }

  @Delete('reviews/:id')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a review' })
  @ApiNoContentResponse({ description: 'Review deleted' })
  async remove(
    @Param('id') id: string,
    @Body() dto: DeleteReviewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.reviews.softDelete(id, user, dto.reason);
  }

  @Post('reviews/:id/vote')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a review as useful or not useful' })
  @ApiOkResponse({ description: 'Updated vote counts' })
  async vote(
    @Param('id') id: string,
    @Body() dto: VoteReviewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewVoteResponse> {
    return this.reviews.vote(id, dto.useful, user);
  }

  @Delete('reviews/:id/vote')
  @Authenticated()
  @ApiOperation({ summary: 'Remove your vote from a review' })
  @ApiOkResponse({ description: 'Updated vote counts' })
  async removeVote(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewVoteResponse> {
    return this.reviews.removeVote(id, user);
  }

  @Post('reviews/:id/report')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Report a review for moderation' })
  @ApiNoContentResponse({ description: 'Report filed' })
  async report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.reviews.report(id, dto, user);
  }
}
