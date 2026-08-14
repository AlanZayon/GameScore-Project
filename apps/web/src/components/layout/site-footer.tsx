import { getTranslations } from 'next-intl/server';

import { publicEnv } from '@/lib/env';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  return (
    <footer className="mt-auto border-t border-border-subtle py-8">
      <div className="container-page flex flex-col gap-2 text-sm text-content-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('builtWith')}</p>
        <a href={`${publicEnv.apiUrl}/api/docs`} className="hover:text-content">
          {t('docs')}
        </a>
      </div>
    </footer>
  );
}
