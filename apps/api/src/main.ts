import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';
import { AppConfigService } from './common/config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  configureApp(app);
  setupSwagger(app);

  const config = app.get(AppConfigService);
  await app.listen(config.port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`GameScore API listening on http://localhost:${config.port}`);
  logger.log(`OpenAPI documentation at http://localhost:${config.port}/api/docs`);
}

void bootstrap();
