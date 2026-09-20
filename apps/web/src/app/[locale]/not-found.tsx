import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="container-page py-16 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-content-muted">{t('notFoundBody')}</p>
      <Link href="/" className="mt-6 inline-block text-brand underline">
        {t('backHome')}
      </Link>
    </main>
  );
}
