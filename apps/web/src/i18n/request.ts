import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';
import en from '../../messages/en.json';
import ptBR from '../../messages/pt-BR.json';

const messagesByLocale = {
  'pt-BR': ptBR,
  en,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Static imports avoid Turbopack serving a stale dynamic JSON module
    // (which surfaced as visible fallbacks like "admin.igdbOn").
    messages: messagesByLocale[locale],
    timeZone: 'America/Sao_Paulo',
    now: new Date(),
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        // Keep the tree alive in edge cases; do not spam the console in prod.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[i18n] ${error.message}`);
        }
        return;
      }
      console.error(error);
    },
  };
});
