import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module';
import { SearchService } from './application/search.service';
import { PostgresSearchProvider } from './providers/postgres-search.provider';
import { SEARCH_PROVIDER } from './providers/search-provider';
import { SearchController } from './search.controller';

@Module({
  imports: [GamesModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    PostgresSearchProvider,
    { provide: SEARCH_PROVIDER, useExisting: PostgresSearchProvider },
  ],
  exports: [SearchService],
})
export class SearchModule {}
