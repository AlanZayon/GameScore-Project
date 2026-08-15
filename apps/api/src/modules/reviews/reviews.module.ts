import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RatingsModule } from '../ratings/ratings.module';
import { AntiSpamService } from './application/anti-spam.service';
import { ReviewBombDetector } from './application/review-bomb-detector.service';
import { ReviewsService } from './application/reviews.service';
import { ReviewRepository } from './repositories/review.repository';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [GamesModule, RatingsModule, IntegrationsModule],
  controllers: [ReviewsController],
  providers: [ReviewRepository, ReviewsService, AntiSpamService, ReviewBombDetector],
  exports: [ReviewRepository, ReviewsService],
})
export class ReviewsModule {}
