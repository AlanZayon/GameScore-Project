import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigService } from './app-config.service';
import { loadAppConfig } from './configuration';

/**
 * `ConfigModule` is used only to load the workspace `.env` file; all reads go
 * through `AppConfigService`, which validates the values once at startup.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      // Run from apps/api, so this is the repository root .env. Absent in
      // Docker, where the environment is provided by compose instead.
      envFilePath: ['../../.env'],
      cache: true,
      expandVariables: true,
    }),
  ],
  providers: [
    {
      provide: AppConfigService,
      useFactory: (): AppConfigService => new AppConfigService(loadAppConfig()),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
