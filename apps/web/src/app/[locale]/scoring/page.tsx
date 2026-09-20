import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'scoring' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function ScoringPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('scoring');

  const sections = [
    { title: t('publicTitle'), body: t('publicBody') },
    { title: t('wilsonTitle'), body: t('wilsonBody') },
    { title: t('rankingTitle'), body: t('rankingBody') },
    { title: t('labelsTitle'), body: t('labelsBody') },
    { title: t('reviewsTitle'), body: t('reviewsBody') },
  ];

  return (
    <main className="container-page max-w-3xl space-y-6 py-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-base text-content-muted">{t('lead')}</p>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="space-y-1.5 border-t border-border-subtle pt-5">
          <h2 className="font-display text-lg font-semibold">{section.title}</h2>
          <p className="text-sm leading-relaxed text-content-muted">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
