import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppException } from './app.exception';
import { ERROR_CODES, type ErrorCode } from './error-codes';

interface ErrorResponseBody {
  code: ErrorCode | string;
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
}

/** Structural check, so the filter does not have to import the Prisma runtime. */
function isPrismaKnownRequestError(error: unknown): error is { code: string; meta?: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string' &&
    (error as { name: string }).name === 'PrismaClientKnownRequestError' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Translates every thrown value into the API's error contract.
 * Stack traces are logged server side and never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { id?: string }>();
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    const { status, body } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed: ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.debug(`${request.method} ${request.url} -> ${status} ${body.code}`);
    }

    response.status(status).json({ ...body, requestId });
  }

  private resolve(exception: unknown): { status: number; body: ErrorResponseBody } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (isPrismaKnownRequestError(exception)) {
      return this.fromPrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    body: ErrorResponseBody;
  } {
    const status = exception.getStatus();
    const response = exception.getResponse();

    // Errors already shaped like our contract (thrown by guards, for instance).
    if (typeof response === 'object' && response !== null && 'code' in response) {
      const shaped = response as ErrorResponseBody;
      return {
        status,
        body: {
          code: shaped.code,
          message: shaped.message ?? exception.message,
          ...(shaped.details ? { details: shaped.details } : {}),
        },
      };
    }

    // ValidationPipe reports an array of human readable messages.
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      Array.isArray((response as { message: unknown }).message)
    ) {
      const messages = (response as { message: string[] }).message;
      return {
        status,
        body: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Request validation failed',
          details: { _: messages },
        },
      };
    }

    return {
      status,
      body: {
        code: this.codeForStatus(status),
        message: exception.message,
      },
    };
  }

  private fromPrismaError(error: { code: string }): {
    status: number;
    body: ErrorResponseBody;
  } {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ERROR_CODES.BAD_REQUEST,
            message: 'A record with these unique values already exists',
          },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: ERROR_CODES.NOT_FOUND, message: 'Resource not found' },
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            code: ERROR_CODES.BAD_REQUEST,
            message: 'A referenced record does not exist',
          },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: { code: ERROR_CODES.INTERNAL_ERROR, message: 'A database error occurred' },
        };
    }
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }
}
