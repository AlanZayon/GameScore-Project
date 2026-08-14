import { Global, Module } from '@nestjs/common';

import { InProcessJobQueue } from './in-process-job-queue';
import { JOB_QUEUE } from './job-queue';

@Global()
@Module({
  providers: [
    InProcessJobQueue,
    {
      provide: JOB_QUEUE,
      useExisting: InProcessJobQueue,
    },
  ],
  exports: [JOB_QUEUE, InProcessJobQueue],
})
export class JobsModule {}
