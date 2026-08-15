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
    <main className="container-page max-w-3xl space-y-8 py-10">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-lg text-content-muted">{t('lead')}</p>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <p className="leading-relaxed text-content-muted">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
