import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="container-page py-24 text-center">
      <h1 className="text-3xl font-bold">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-content-muted">{t('notFoundBody')}</p>
      <Link href="/" className="mt-6 inline-block text-brand underline">
        {t('backHome')}
      </Link>
    </main>
  );
}
