import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RatingsModule } from '../ratings/ratings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminController } from './admin.controller';
import { AdminService } from './application/admin.service';
import { AuditService } from './application/audit.service';

@Module({
  imports: [GamesModule, ReviewsModule, RatingsModule, IntegrationsModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService],
  exports: [AuditService],
})
export class AdminModule {}
