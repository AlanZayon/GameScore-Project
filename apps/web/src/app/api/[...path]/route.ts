import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function upstreamBase(): string {
  const raw = process.env.API_REWRITE_TARGET || process.env.API_INTERNAL_URL || '';
  return raw.replace(/\/$/, '');
}

/**
 * Proxy the ASP.NET API under the web origin so the refresh cookie is first-party.
 *
 * Uses node:http(s) instead of fetch so Set-Cookie headers stay intact (Node fetch
 * can hide/join them). The upstream name=value is preserved exactly; only Path /
 * HttpOnly / Secure / SameSite=Lax are forced for first-party use on the web origin.
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

  const outbound: Record<string, string> = {};
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
    if (value) outbound[name] = value;
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;
  if (body) outbound['content-length'] = String(body.length);

  const upstream = await nodeRequest(target, method, outbound, body);

  const response = new NextResponse(new Uint8Array(upstream.body), {
    status: upstream.statusCode,
  });

  for (const [key, value] of Object.entries(upstream.headers)) {
    const lower = key.toLowerCase();
    if (
      lower === 'set-cookie' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'connection'
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) response.headers.append(key, item);
    } else if (value !== undefined) {
      response.headers.set(key, value);
    }
  }

  const rawCookies = normalizeSetCookie(upstream.headers['set-cookie']);
  for (const raw of rawCookies) {
    // Prefer append so the token value is not re-encoded by NextResponse.cookies.set().
    response.headers.append('set-cookie', toFirstPartyCookie(raw));
  }

  const inboundRefresh = readCookieValue(request.headers.get('cookie'), 'gs_refresh_token');
  const outboundPair = rawCookies[0]?.split(';', 1)[0] ?? '';
  const outboundEq = outboundPair.indexOf('=');
  const outboundLen = outboundEq > 0 ? outboundPair.slice(outboundEq + 1).length : 0;

  response.headers.set('x-gs-proxy', '2');
  response.headers.set('x-gs-proxy-cookies', String(rawCookies.length));
  response.headers.set('x-gs-proxy-refresh-in', inboundRefresh ? String(inboundRefresh.length) : '0');
  response.headers.set('x-gs-proxy-refresh-out', String(outboundLen));

  return response;
}

function nodeRequest(
  target: URL,
  method: string,
  headers: Record<string, string>,
  body?: Buffer,
): Promise<{ statusCode: number; headers: IncomingMessage['headers']; body: Buffer }> {
  const transport = target.protocol === 'http:' ? httpRequest : httpsRequest;
  const options: RequestOptions = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    path: `${target.pathname}${target.search}`,
    method,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = transport(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 502,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function normalizeSetCookie(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

/** Preserve name=value exactly; only force first-party cookie attributes. */
function toFirstPartyCookie(setCookie: string): string {
  const parts = setCookie.split(';').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return setCookie;

  const [pair, ...attrs] = parts;
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

function readCookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return trimmed.slice(eq + 1);
  }
  return null;
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
