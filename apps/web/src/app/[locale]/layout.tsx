import '../globals.css';

import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AuthProvider } from '@/components/providers/auth-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
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
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas text-content antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <QueryProvider>
              <AuthProvider>
                <ToastProvider>
                  <div className="flex min-h-dvh flex-col">
                    <SiteHeader />
                    <div className="flex-1">{children}</div>
                    <SiteFooter />
                  </div>
                </ToastProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
