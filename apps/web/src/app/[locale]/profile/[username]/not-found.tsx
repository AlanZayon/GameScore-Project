import { getTranslations } from 'next-intl/server';

export default async function ProfileNotFound() {
  const t = await getTranslations('profile');

  return (
    <main className="container-page flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-2xl font-semibold">{t('userRemovedTitle')}</h1>
      <p className="mt-2 max-w-md text-content-muted">{t('userRemovedBody')}</p>
    </main>
  );
}
