import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { publicEnv } from '@/lib/env';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const showDocs = process.env.NODE_ENV !== 'production';
  return (
    <footer className="mt-auto border-t border-border-subtle py-8">
      <div className="container-page flex flex-col gap-3 text-sm text-content-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('builtWith')}</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/scoring" className="hover:text-content">
            {t('scoring')}
          </Link>
          <Link href="/games" className="hover:text-content">
            {t('games')}
          </Link>
          <Link href="/rankings" className="hover:text-content">
            {t('rankings')}
          </Link>
          {showDocs ? (
            <a href={`${publicEnv.apiUrl}/api/docs`} className="hover:text-content">
              {t('docs')}
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
