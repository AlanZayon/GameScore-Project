/** Shape of every error the API returns. Never a stack trace. */
export interface ApiErrorResponse {
  code: string;
  message: string;
  /** Field-level validation problems, when applicable. */
  details?: Record<string, string[]>;
  requestId?: string;
}

/** Offset pagination, used for catalogue style listings. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PageMeta;
}

/** Cursor pagination, used wherever the list can grow without bound. */
export interface CursorMeta {
  limit: number;
  /** Opaque cursor to pass back to fetch the following page. */
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  meta: CursorMeta;
}
