'use client';

import {
  NextIntlClientProvider,
  type AbstractIntlMessages,
  type IntlError,
} from 'next-intl';
import type { ReactNode } from 'react';

function onIntlError(error: IntlError) {
  if (error.code === 'MISSING_MESSAGE') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] ${error.message}`);
    }
    return;
  }
  console.error(error);
}

/** Prefer a readable fragment over "namespace.key" when a message is briefly missing. */
function messageFallback({ key }: { namespace?: string; key: string }) {
  const leaf = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  return leaf
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
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
      timeZone="America/Sao_Paulo"
      onError={onIntlError}
      getMessageFallback={messageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
