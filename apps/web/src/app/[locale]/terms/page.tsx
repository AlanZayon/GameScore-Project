import type { Metadata } from 'next';

import { generateLegalMetadata, LegalDocument } from '@/components/legal/legal-document';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateLegalMetadata(locale, 'terms');
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalDocument locale={locale} kind="terms" />;
}
