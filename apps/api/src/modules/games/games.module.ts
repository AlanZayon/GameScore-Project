import { Module } from '@nestjs/common';

import { GameViewService } from './application/game-view.service';
import { GamesService } from './application/games.service';
import { GamesController } from './games.controller';
import { GameRepository } from './repositories/game.repository';

@Module({
  controllers: [GamesController],
  providers: [GameRepository, GamesService, GameViewService],
  exports: [GameRepository, GamesService],
})
export class GamesModule {}
