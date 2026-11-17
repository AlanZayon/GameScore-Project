import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { buildNoIndexMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return buildNoIndexMetadata(locale, '/admin', t('metaTitle'), t('metaDescription'));
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
