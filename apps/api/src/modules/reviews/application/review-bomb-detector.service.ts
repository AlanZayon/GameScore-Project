import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  assessReviewBomb,
  REVIEW_BOMB_BASELINE_WINDOW_DAYS,
  type DailyReviewActivity,
} from '@gamescore/shared';

import { isoDate, utcDate } from '../../../common/crypto/hash';
import {
  JOB_NAMES,
  type DetectReviewBombPayload,
} from '../../../common/jobs/job-names';
import { JOB_QUEUE, type JobQueue } from '../../../common/jobs/job-queue';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ReviewBombDetector implements OnModuleInit {
  private readonly logger = new Logger(ReviewBombDetector.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<DetectReviewBombPayload>(JOB_NAMES.DETECT_REVIEW_BOMB, (payload) =>
      this.inspect(payload.gameId, payload.date),
    );
  }

  async inspect(gameId: string, dateIso: string): Promise<void> {
    const day = utcDate(new Date(`${dateIso}T00:00:00.000Z`));
    const historyStart = new Date(day);
    historyStart.setUTCDate(historyStart.getUTCDate() - REVIEW_BOMB_BASELINE_WINDOW_DAYS);

    const rows = await this.prisma.gameActivityDaily.findMany({
      where: { gameId, date: { gte: historyStart, lte: day } },
      orderBy: { date: 'asc' },
    });

    const history: DailyReviewActivity[] = rows
      .filter((row) => isoDate(row.date) !== dateIso)
      .map((row) => ({
        date: isoDate(row.date),
        positive: row.positiveCount,
        negative: row.negativeCount,
      }));

    const today = rows.find((row) => isoDate(row.date) === dateIso);
    const assessed = assessReviewBomb(
      {
        date: dateIso,
        positive: today?.positiveCount ?? 0,
        negative: today?.negativeCount ?? 0,
      },
      history,
    );

    if (!assessed.anomalous || assessed.direction === 'NONE') {
      return;
    }

    const startAt = day;
    const endAt = new Date(day);
    endAt.setUTCDate(endAt.getUTCDate() + 1);
    endAt.setUTCMilliseconds(endAt.getUTCMilliseconds() - 1);

    await this.prisma.reviewBombEvent.upsert({
      where: { gameId_startAt: { gameId, startAt } },
      create: {
        gameId,
        startAt,
        endAt,
        positiveCount: assessed.positive,
        negativeCount: assessed.negative,
        baselinePerDay: assessed.baselinePerDay,
        severity: assessed.severity,
        direction: assessed.direction,
        status: 'DETECTED',
      },
      update: {
        positiveCount: assessed.positive,
        negativeCount: assessed.negative,
        baselinePerDay: assessed.baselinePerDay,
        severity: assessed.severity,
        direction: assessed.direction,
      },
    });

    await this.prisma.review.updateMany({
      where: {
        gameId,
        deletedAt: null,
        createdAt: { gte: startAt, lte: endAt },
        moderationStatus: { not: 'REVIEW_BOMB' },
      },
      data: { moderationStatus: 'REVIEW_BOMB' },
    });

    this.logger.warn(
      `Review bomb ${assessed.direction} detected for game ${gameId} on ${dateIso} (severity ${assessed.severity.toFixed(2)})`,
    );
  }
}
