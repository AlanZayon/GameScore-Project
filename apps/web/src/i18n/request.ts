import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'America/Sao_Paulo',
    now: new Date(),
    // Avoid crashing the tree when Turbopack serves a briefly stale messages module.
    getMessageFallback({ namespace, key }) {
      return namespace ? `${namespace}.${key}` : key;
    },
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') return;
      console.error(error);
    },
  };
});
