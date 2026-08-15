import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { ConsoleEmailAdapter } from './console-email.adapter';
import { EMAIL_PORT, type EmailPort } from './email.port';
import { SmtpEmailAdapter } from './smtp-email.adapter';

@Global()
@Module({
  providers: [
    ConsoleEmailAdapter,
    {
      provide: EMAIL_PORT,
      inject: [AppConfigService, ConsoleEmailAdapter],
      useFactory: (config: AppConfigService, consoleAdapter: ConsoleEmailAdapter): EmailPort => {
        if (config.isTest || !config.smtp) {
          return consoleAdapter;
        }
        return new SmtpEmailAdapter(config);
      },
    },
  ],
  exports: [EMAIL_PORT, ConsoleEmailAdapter],
})
export class EmailModule {}
