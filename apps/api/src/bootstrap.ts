import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppConfigService } from './common/config/app-config.service';

/**
 * Shared application wiring, applied identically by `main.ts` and by the
 * end-to-end tests. Keeping it here means the suite exercises the same
 * middleware, validation and error handling as production.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfigService);

  app.use(
    helmet({
      // The API serves JSON and the Swagger UI; a strict CSP would break the
      // latter without protecting the former.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Browser app is on another origin (different port on localhost). Helmet's
      // default CORP "same-origin" turns credentialed cross-origin fetch into
      // a opaque "Failed to fetch" in Chromium.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not declared on a DTO is stripped, and unknown fields are
      // rejected outright: never trust the client.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    }),
  );

  if (config.globalPrefix) {
    app.setGlobalPrefix(config.globalPrefix);
  }

  app.set('trust proxy', 1);
  app.enableShutdownHooks();
}

/** Mounts the OpenAPI contract and Swagger UI at `/api/docs`. */
export function setupSwagger(app: NestExpressApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('GameScore API')
      .setDescription(
        'Game discovery and rating platform. Scores are Wilson lower bounds over ' +
          'player recommendations, so the amount of evidence behind a rating matters.',
      )
      .setVersion('0.1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by POST /auth/login',
      })
      .addTag('auth', 'Registration, login, refresh and logout')
      .addTag('games', 'Catalogue, game detail, statistics and search')
      .addTag('reviews', 'Reviews, helpfulness votes and reports')
      .addTag('rankings', 'Top rated, trending, new releases and popular')
      .addTag('users', 'Public profiles')
      .addTag('admin', 'Moderation and catalogue administration')
      .addTag('health', 'Service health')
      .build(),
  );

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs/json',
    swaggerOptions: { persistAuthorization: true },
  });
}
