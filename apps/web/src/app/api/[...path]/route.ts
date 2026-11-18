import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function upstreamBase(): string {
  const raw =
    process.env.API_REWRITE_TARGET ||
    process.env.API_INTERNAL_URL ||
    '';
  return raw.replace(/\/$/, '');
}

/**
 * Vercel config rewrites can drop or mishandle upstream Set-Cookie for auth.
 * This route proxies the ASP.NET API and rewrites refresh cookies to first-party
 * SameSite=Lax on the web origin.
 */
async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const base = upstreamBase();
  if (!base) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'API upstream is not configured' },
      { status: 500 },
    );
  }

  const target = new URL(`${base}/${path.map(encodeURIComponent).join('/')}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const forward = [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'cookie',
    'idempotency-key',
    'user-agent',
    'x-request-id',
  ];
  for (const name of forward) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie') return;
    if (
      lower === 'transfer-encoding' ||
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'connection'
    ) {
      return;
    }
    responseHeaders.set(key, value);
  });

  const rawCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
  for (const cookie of rawCookies) {
    responseHeaders.append('set-cookie', toFirstPartyCookie(cookie));
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

function toFirstPartyCookie(setCookie: string): string {
  const [pair, ...attrs] = setCookie.split(';').map((part) => part.trim());
  const kept = attrs.filter((attr) => {
    const lower = attr.toLowerCase();
    if (lower.startsWith('domain=')) return false;
    if (lower.startsWith('samesite=')) return false;
    if (lower === 'partitioned') return false;
    if (lower.startsWith('path=')) return false;
    if (lower === 'secure') return false;
    if (lower === 'httponly') return false;
    return true;
  });

  return [pair, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', ...kept].join('; ');
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxy(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
