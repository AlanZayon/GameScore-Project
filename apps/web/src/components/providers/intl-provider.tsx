'use client';

import {
  NextIntlClientProvider,
  type AbstractIntlMessages,
  type IntlError,
} from 'next-intl';
import type { ReactNode } from 'react';

function onIntlError(error: IntlError) {
  // Stale Turbopack message modules can briefly miss new keys; don't crash the tree.
  if (error.code === 'MISSING_MESSAGE') return;
  console.error(error);
}

function messageFallback({ namespace, key }: { namespace?: string; key: string }) {
  return namespace ? `${namespace}.${key}` : key;
}

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onIntlError}
      getMessageFallback={messageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
