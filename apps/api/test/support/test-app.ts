import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { InProcessJobQueue } from '../../src/common/jobs/in-process-job-queue';
import { PrismaService } from '../../src/common/prisma/prisma.service';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  jobs: InProcessJobQueue;
  /** Truncates every table, so each test starts from a known state. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Boots the real application against the real test database, with the same
 * middleware, validation and error handling as production. Nothing is mocked:
 * these tests fail if the wiring is wrong, which is the point.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const jobs = app.get(InProcessJobQueue);

  return {
    app,
    prisma,
    jobs,
    reset: () => prisma.truncateAllTables(),
    close: async () => {
      await jobs.drain();
      await app.close();
    },
  };
}
