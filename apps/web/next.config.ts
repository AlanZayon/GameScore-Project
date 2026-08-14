import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
};

export default withNextIntl(nextConfig);
