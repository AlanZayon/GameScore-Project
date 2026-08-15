import { serverEnv, publicEnv } from './env';
import type { ApiErrorResponse } from '@gamescore/types';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type AccessTokenRefresher = () => Promise<string | null>;

let accessTokenRefresher: AccessTokenRefresher | null = null;

/** AuthProvider registers a refresher so expired access tokens can rotate in place. */
export function setAccessTokenRefresher(refresher: AccessTokenRefresher | null): void {
  accessTokenRefresher = refresher;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  accessToken?: string | null;
  /** ISR window in seconds. `false` forces `no-store`. Authenticated calls are never cached. */
  revalidate?: number | false;
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const fromServer = typeof window === 'undefined';
  const base = fromServer ? serverEnv.internalApiUrl : publicEnv.apiUrl;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const { accessToken: _token, revalidate, _retried, body, ...rest } = options;
  const skipCache = fromServer && (revalidate === false || Boolean(options.accessToken));
  const cacheInit: RequestInit & { next?: { revalidate: number } } = skipCache
    ? { cache: 'no-store' }
    : fromServer
      ? { next: { revalidate: typeof revalidate === 'number' ? revalidate : 60 } }
      : { cache: options.cache };

  const response = await fetch(`${base}${path}`, {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    ...cacheInit,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as T | ApiErrorResponse | null;
  if (!response.ok) {
    const shouldRetry =
      typeof window !== 'undefined' &&
      !_retried &&
      response.status === 401 &&
      Boolean(accessTokenRefresher) &&
      !path.startsWith('/auth/');

    if (shouldRetry && accessTokenRefresher) {
      const nextToken = await accessTokenRefresher();
      if (nextToken) {
        return apiFetch<T>(path, { ...options, accessToken: nextToken, _retried: true });
      }
    }

    const error = payload as ApiErrorResponse | null;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Request failed',
      response.status,
      error?.details,
    );
  }

  return payload as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
