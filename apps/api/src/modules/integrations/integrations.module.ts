import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module';
import { GameImportService } from './application/game-import.service';
import { GameSyncService } from './application/game-sync.service';
import { IgdbClient } from './igdb/igdb.client';

@Module({
  imports: [GamesModule],
  providers: [IgdbClient, GameImportService, GameSyncService],
  exports: [IgdbClient, GameImportService, GameSyncService],
})
export class IntegrationsModule {}
