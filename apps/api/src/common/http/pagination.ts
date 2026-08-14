import type { CursorMeta, PageMeta, PaginatedResponse } from '@gamescore/types';

import { BadRequestError } from '../errors/app.exception';
import { ERROR_CODES } from '../errors/error-codes';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_CURSOR_SIZE = 20;
export const MAX_CURSOR_SIZE = 50;

export function clampPage(page?: number): number {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(1, Math.trunc(page));
}

export function clampLimit(limit?: number, fallback = DEFAULT_PAGE_SIZE): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
}

export function pageMeta(total: number, page: number, limit: number): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return { items, meta: pageMeta(total, page, limit) };
}

export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<T>(cursor: string): T {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return parsed as T;
  } catch {
    throw new BadRequestError(ERROR_CODES.INVALID_CURSOR, 'Invalid pagination cursor');
  }
}

export function cursorMeta(limit: number, nextCursor: string | null): CursorMeta {
  return {
    limit,
    nextCursor,
    hasNextPage: nextCursor !== null,
  };
}
