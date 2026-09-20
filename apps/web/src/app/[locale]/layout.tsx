import { hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { CookieBanner } from '@/components/legal/cookie-banner';
import { DocumentLang } from '@/components/providers/document-lang';
import { IntlProvider } from '@/components/providers/intl-provider';
import { routing } from '@/i18n/routing';
import { publicEnv } from '@/lib/env';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: {
      default: t('metaTitle'),
      template: '%s — GameScore',
    },
    description: t('metaDescription'),
    applicationName: 'GameScore',
    icons: {
      icon: [
        { url: '/icon', type: 'image/png', sizes: '32x32' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
    },
    alternates: {
      canonical: '/',
      languages: {
        'pt-BR': '/',
        en: '/en',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'GameScore',
      title: t('metaTitle'),
      description: t('metaDescription'),
      locale,
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <IntlProvider locale={locale} messages={messages}>
      <DocumentLang locale={locale} />
      <NavigationProgress />
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <CookieBanner />
      </div>
    </IntlProvider>
  );
}
