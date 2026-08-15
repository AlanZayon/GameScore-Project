import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type LegalKind = 'terms' | 'privacy' | 'cookies';

export async function generateLegalMetadata(
  locale: string,
  kind: LegalKind,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `legal.${kind}` });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export async function LegalDocument({
  locale,
  kind,
}: {
  locale: string;
  kind: LegalKind;
}) {
  setRequestLocale(locale);
  const t = await getTranslations(`legal.${kind}`);
  const disclaimer = await getTranslations('legal');
  const sections = t.raw('sections') as Array<{ title: string; body: string }>;

  return (
    <main className="container-page max-w-3xl space-y-8 py-10">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-lg text-content-muted">{t('lead')}</p>
        <p className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-content-muted">
          {disclaimer('disclaimer')}
        </p>
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
