import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AdminDashboardDto,
  AdminUserDto,
  ImportGameResultDto,
  PaginatedResponse,
  ReviewBombEventDto,
  ReviewDto,
  ReviewReportDto,
} from '@gamescore/types';
import type { GameSummaryDto } from '@gamescore/types';

import { RequireRoles } from '../auth/decorators/auth.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/domain/auth-user';
import { AdminService } from './application/admin.service';
import {
  AdminPageQueryDto,
  ImportGameByNameDto,
  ImportGameDto,
  ModerateReviewDto,
  ResolveReportDto,
  UpdateGameDto,
  UpdateReviewBombDto,
  UpdateUserDto,
} from './dto/admin.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'Moderation dashboard totals' })
  @ApiOkResponse({ description: 'Dashboard' })
  dashboard(): Promise<AdminDashboardDto> {
    return this.admin.dashboard();
  }

  @Get('games')
  @RequireRoles('ADMIN')
  @ApiOperation({ summary: 'List games for administration' })
  listGames(@Query() query: AdminPageQueryDto): Promise<PaginatedResponse<GameSummaryDto>> {
    return this.admin.listGames(query.page, query.limit, query.q);
  }

  @Patch('games/:id')
  @RequireRoles('ADMIN')
  @ApiOperation({ summary: 'Edit game metadata; edited fields are protected from IGDB sync' })
  updateGame(
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<GameSummaryDto> {
    return this.admin.updateGame(id, dto, actor);
  }

  @Post('games/import')
  @RequireRoles('ADMIN')
  @ApiOperation({ summary: 'Import a game from IGDB by external id' })
  importGame(
    @Body() dto: ImportGameDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ImportGameResultDto> {
    return this.admin.importGame(dto.externalId, actor);
  }

  @Post('games/import/search')
  @RequireRoles('ADMIN')
  @ApiOperation({ summary: 'Import the best IGDB match for a name' })
  importByName(
    @Body() dto: ImportGameByNameDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ImportGameResultDto> {
    return this.admin.importGameByName(dto.name, actor);
  }

  @Post('games/:id/sync')
  @RequireRoles('ADMIN')
  @ApiOperation({ summary: 'Re-sync a game from IGDB without overwriting edited fields' })
  syncGame(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ImportGameResultDto> {
    return this.admin.syncGame(id, actor);
  }

  @Post('games/:id/recalculate')
  @RequireRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rebuild derived statistics for a game' })
  async recalculate(@Param('id') id: string, @CurrentUser() actor: AuthUser): Promise<void> {
    await this.admin.recalculateGame(id, actor);
  }

  @Get('reviews')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'List reviews for moderation' })
  listReviews(@Query() query: AdminPageQueryDto): Promise<PaginatedResponse<ReviewDto>> {
    return this.admin.listReviews(query.page, query.limit, query.status);
  }

  @Post('reviews/:id/remove')
  @RequireRoles('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a review as a moderator' })
  async removeReview(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.admin.removeReview(id, actor, dto.reason);
  }

  @Post('reviews/:id/restore')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'Restore a soft-deleted review' })
  restoreReview(@Param('id') id: string, @CurrentUser() actor: AuthUser): Promise<ReviewDto> {
    return this.admin.restoreReview(id, actor);
  }

  @Patch('reviews/:id/moderation')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'Update a review moderation classification' })
  updateModeration(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ReviewDto> {
    return this.admin.updateReviewModeration(
      id,
      actor,
      dto.moderationStatus ?? 'MODERATION_REQUIRED',
      dto.reason,
    );
  }

  @Get('reports')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'List review reports' })
  listReports(@Query() query: AdminPageQueryDto): Promise<PaginatedResponse<ReviewReportDto>> {
    return this.admin.listReports(
      query.page,
      query.limit,
      query.status as 'PENDING' | 'RESOLVED' | 'DISMISSED' | undefined,
    );
  }

  @Post('reports/:id/resolve')
  @RequireRoles('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resolve or dismiss a report' })
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.admin.resolveReport(id, actor, dto);
  }

  @Get('review-bombs')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'List detected review bomb windows' })
  listBombs(@Query() query: AdminPageQueryDto): Promise<PaginatedResponse<ReviewBombEventDto>> {
    return this.admin.listReviewBombs(
      query.page,
      query.limit,
      query.status as 'DETECTED' | 'CONFIRMED' | 'DISMISSED' | undefined,
    );
  }

  @Patch('review-bombs/:id')
  @RequireRoles('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm or dismiss a review bomb event' })
  async updateBomb(
    @Param('id') id: string,
    @Body() dto: UpdateReviewBombDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.admin.updateReviewBomb(id, actor, dto.status, dto.notes);
  }

  @Get('users')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'List users (moderators can list; role changes remain admin-only on PATCH)' })
  listUsers(@Query() query: AdminPageQueryDto): Promise<PaginatedResponse<AdminUserDto>> {
    return this.admin.listUsers(query.page, query.limit, query.q);
  }

  @Patch('users/:id')
  @RequireRoles('MODERATOR')
  @ApiOperation({ summary: 'Suspend, reinstate or (admins only) change a role' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AdminUserDto> {
    return this.admin.updateUser(id, dto, actor);
  }
}
