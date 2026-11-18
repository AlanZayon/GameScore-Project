import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function upstreamBase(): string {
  const raw = process.env.API_REWRITE_TARGET || process.env.API_INTERNAL_URL || '';
  return raw.replace(/\/$/, '');
}

/**
 * Proxy the ASP.NET API under the web origin so the refresh cookie is first-party.
 * Prefer NextResponse.cookies.set — raw Set-Cookie headers are unreliable on Vercel.
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
  for (const name of [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'cookie',
    'idempotency-key',
    'user-agent',
    'x-request-id',
  ]) {
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
  const body = await upstream.arrayBuffer();

  const response = new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'set-cookie' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'connection'
    ) {
      return;
    }
    response.headers.set(key, value);
  });

  const rawCookies = collectSetCookies(upstream.headers);
  for (const raw of rawCookies) {
    applyFirstPartyCookie(response, raw);
  }
  response.headers.set('x-gs-proxy', '1');
  response.headers.set('x-gs-proxy-cookies', String(rawCookies.length));

  return response;
}

function collectSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    const listed = headers.getSetCookie();
    if (listed.length > 0) return listed;
  }

  const fallback: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') fallback.push(value);
  });
  return fallback;
}

function applyFirstPartyCookie(response: NextResponse, setCookie: string): void {
  const parts = setCookie.split(';').map((part) => part.trim());
  const [nameValue, ...attrs] = parts;
  const eq = nameValue.indexOf('=');
  if (eq <= 0) return;

  const name = nameValue.slice(0, eq);
  const value = nameValue.slice(eq + 1);
  let expires: Date | undefined;
  let maxAge: number | undefined;

  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower.startsWith('expires=')) {
      const parsed = new Date(attr.slice('expires='.length));
      if (!Number.isNaN(parsed.getTime())) expires = parsed;
    } else if (lower.startsWith('max-age=')) {
      const parsed = Number(attr.slice('max-age='.length));
      if (Number.isFinite(parsed)) maxAge = parsed;
    }
  }

  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    ...(expires ? { expires } : {}),
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
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
