import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="container-page py-24 text-center">
      <h1 className="text-3xl font-bold">{t('emptyTitle')}</h1>
      <Link href="/" className="mt-4 inline-block text-brand underline">
        GameScore
      </Link>
    </main>
  );
}
