import { Global, Module } from '@nestjs/common';

import { ConsoleEmailAdapter } from './console-email.adapter';
import { EMAIL_PORT } from './email.port';

@Global()
@Module({
  providers: [
    ConsoleEmailAdapter,
    { provide: EMAIL_PORT, useExisting: ConsoleEmailAdapter },
  ],
  exports: [EMAIL_PORT, ConsoleEmailAdapter],
})
export class EmailModule {}
