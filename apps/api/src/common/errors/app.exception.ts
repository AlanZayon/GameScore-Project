import { HttpException, HttpStatus } from '@nestjs/common';

import { ERROR_CODES, type ErrorCode } from './error-codes';

export interface AppExceptionBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, string[]>;
}

/**
 * Base class for every deliberate error in the application. Carrying the code
 * on the exception keeps the HTTP contract (`{ code, message }`) consistent
 * without controllers having to shape error responses themselves.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, string[]>,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppException {
  constructor(code: ErrorCode = ERROR_CODES.NOT_FOUND, message = 'Resource not found') {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends AppException {
  constructor(code: ErrorCode, message: string) {
    super(code, message, HttpStatus.CONFLICT);
  }
}

export class BadRequestError extends AppException {
  constructor(
    code: ErrorCode = ERROR_CODES.BAD_REQUEST,
    message = 'Bad request',
    details?: Record<string, string[]>,
  ) {
    super(code, message, HttpStatus.BAD_REQUEST, details);
  }
}

export class UnauthorizedError extends AppException {
  constructor(code: ErrorCode = ERROR_CODES.UNAUTHORIZED, message = 'Authentication required') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppException {
  constructor(code: ErrorCode = ERROR_CODES.FORBIDDEN, message = 'Not allowed') {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class TooManyRequestsError extends AppException {
  constructor(
    code: ErrorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED,
    message = 'Too many requests, please slow down',
  ) {
    super(code, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
