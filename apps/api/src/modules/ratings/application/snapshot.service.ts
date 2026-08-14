import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { utcDate } from '../../../common/crypto/hash';
import { JOB_NAMES } from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenService } from '../../auth/application/token.service';

@Injectable()
export class SnapshotService implements OnModuleInit {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register(JOB_NAMES.SNAPSHOT_SCORES, () => this.snapshotToday());
    this.jobs.register(JOB_NAMES.MAINTENANCE, () => this.runMaintenance());
  }

  @Cron('15 3 * * *')
  async scheduledSnapshot(): Promise<void> {
    await this.jobs.enqueue(JOB_NAMES.SNAPSHOT_SCORES, {});
  }

  @Cron('0 4 * * *')
  async scheduledMaintenance(): Promise<void> {
    await this.jobs.enqueue(JOB_NAMES.MAINTENANCE, {});
  }

  async snapshotToday(): Promise<void> {
    const date = utcDate();
    const stats = await this.prisma.gameStatistics.findMany();

    for (const row of stats) {
      await this.prisma.gameScoreSnapshot.upsert({
        where: { gameId_date: { gameId: row.gameId, date } },
        create: {
          gameId: row.gameId,
          date,
          totalReviews: row.totalReviews,
          positiveReviews: row.positiveReviews,
          negativeReviews: row.negativeReviews,
          positivePercentage: row.positivePercentage,
          confidenceScore: row.confidenceScore,
        },
        update: {
          totalReviews: row.totalReviews,
          positiveReviews: row.positiveReviews,
          negativeReviews: row.negativeReviews,
          positivePercentage: row.positivePercentage,
          confidenceScore: row.confidenceScore,
        },
      });
    }

    this.logger.log(`Wrote ${stats.length} score snapshots for ${date.toISOString().slice(0, 10)}`);
  }

  async runMaintenance(): Promise<void> {
    const deleted = await this.tokens.deleteExpiredTokens();
    this.logger.log(`Maintenance removed ${deleted} expired refresh tokens`);
  }
}
