import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigService } from '../config/app-config.service';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured JSON logging with a request id on every line.
 *
 * The redaction list is the security-critical part: credentials, tokens and
 * cookies must never reach the logs, however deeply they are nested.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (request: IncomingMessage, response: ServerResponse): string => {
            const incoming = request.headers[REQUEST_ID_HEADER];
            const id = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
            response.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["set-cookie"]',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.accessToken',
              'req.body.refreshToken',
              'accessToken',
              'refreshToken',
              'password',
              'passwordHash',
              'tokenHash',
            ],
            censor: '[redacted]',
          },
          autoLogging: {
            ignore: (request: IncomingMessage): boolean => {
              const url = request.url ?? '';
              return url === '/health' || url.startsWith('/docs');
            },
          },
          customSuccessMessage: (request: IncomingMessage, response: ServerResponse): string =>
            `${request.method} ${request.url} -> ${response.statusCode}`,
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname,req,res,responseTime',
                },
              },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
