import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const isProduction = process.env.NODE_ENV === 'production';

function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.igdb.com https://cdn.cloudflare.steamstatic.com https://i.ytimg.com",
    `connect-src 'self' ${apiUrl}`,
    "font-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Game artwork is served from the metadata provider's CDN. Only URLs are
    // stored in the database; the images themselves are never proxied.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  experimental: {
    // Server Components fetch the API directly; keep payloads lean.
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
