import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { BullMqJobQueue } from './bullmq-job-queue';
import { InProcessJobQueue } from './in-process-job-queue';
import { JOB_QUEUE, type JobQueue } from './job-queue';

@Global()
@Module({
  providers: [
    InProcessJobQueue,
    {
      provide: JOB_QUEUE,
      inject: [AppConfigService, InProcessJobQueue],
      useFactory: (config: AppConfigService, inProcess: InProcessJobQueue): JobQueue => {
        if (config.isTest || !config.redisUrl) {
          return inProcess;
        }
        return new BullMqJobQueue(config.redisUrl);
      },
    },
  ],
  exports: [JOB_QUEUE, InProcessJobQueue],
})
export class JobsModule {}
