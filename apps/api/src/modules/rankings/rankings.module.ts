import { Module } from '@nestjs/common';

import { RankingsService } from './application/rankings.service';
import { RankingsController } from './rankings.controller';

@Module({
  controllers: [RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
