/**
 * Only same-origin relative paths are allowed as post-login redirects.
 * Protocol-relative (`//evil`) and backslash tricks are rejected.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return '/';
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return '/';
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) {
    return '/';
  }
  if (decoded.includes('://')) return '/';
  return decoded;
}

export function loginPath(next?: string | null): string {
  const safe = safeNextPath(next);
  if (safe === '/') return '/login';
  return `/login?next=${encodeURIComponent(safe)}`;
}

export function registerPath(next?: string | null): string {
  const safe = safeNextPath(next);
  if (safe === '/') return '/register';
  return `/register?next=${encodeURIComponent(safe)}`;
}
