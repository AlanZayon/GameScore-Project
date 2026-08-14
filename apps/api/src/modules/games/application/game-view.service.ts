import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { utcDate } from '../../../common/crypto/hash';
import { JOB_NAMES, type RecordGameViewPayload } from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import { GameRepository } from '../repositories/game.repository';

@Injectable()
export class GameViewService implements OnModuleInit {
  constructor(
    private readonly games: GameRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<RecordGameViewPayload>(JOB_NAMES.RECORD_GAME_VIEW, (payload) =>
      this.record(payload.gameId),
    );
  }

  async record(gameId: string): Promise<void> {
    await this.games.incrementViewCount(gameId, utcDate());
  }
}
