import type { MetadataRoute } from 'next';

import { siteOrigin } from '@/lib/seo';

const PRIVATE_PATHS = [
  '/admin',
  '/settings',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  const disallow = [
    ...PRIVATE_PATHS,
    ...PRIVATE_PATHS.map((path) => `/en${path}`),
  ];

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
