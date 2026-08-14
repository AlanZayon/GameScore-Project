import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module';
import { ReputationService } from './application/reputation.service';
import { ReviewRankingService } from './application/review-ranking.service';
import { ScoreRecalculationService } from './application/score-recalculation.service';
import { SnapshotService } from './application/snapshot.service';
import { StatisticsService } from './application/statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [GamesModule],
  controllers: [StatisticsController],
  providers: [
    ReviewRankingService,
    ReputationService,
    ScoreRecalculationService,
    StatisticsService,
    SnapshotService,
  ],
  exports: [
    ReviewRankingService,
    ReputationService,
    ScoreRecalculationService,
    StatisticsService,
  ],
})
export class RatingsModule {}
