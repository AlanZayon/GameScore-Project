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
    <main className="container-page max-w-3xl space-y-6 py-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-base text-content-muted">{t('lead')}</p>
        <p className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5 text-sm text-content-muted">
          {disclaimer('disclaimer')}
        </p>
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
