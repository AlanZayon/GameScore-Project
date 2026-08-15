'use client';

import type { ImportGameResultDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAdminAction } from '@/components/admin/use-admin-action';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export function AdminImportPanel({ accessToken }: { accessToken: string | null }) {
  const t = useTranslations('admin');
  const { run, isBusy } = useAdminAction();
  const [importId, setImportId] = useState('');
  const [importName, setImportName] = useState('');
  const [lastResult, setLastResult] = useState<ImportGameResultDto | null>(null);

  return (
    <div className="max-w-lg space-y-8">
      <section className="space-y-3 rounded-card border border-border-subtle bg-surface p-4">
        <h2 className="font-semibold">{t('importByIdTitle')}</h2>
        <p className="text-sm text-content-muted">{t('importHelp')}</p>
        <Label htmlFor="igdb-id">{t('importIdLabel')}</Label>
        <Input
          id="igdb-id"
          value={importId}
          onChange={(event) => setImportId(event.target.value)}
          placeholder="1942"
        />
        <Button
          disabled={isBusy() || !importId.trim()}
          onClick={() =>
            void run(
              'import-id',
              async () => {
                const result = await apiFetch<ImportGameResultDto>('/admin/games/import', {
                  method: 'POST',
                  accessToken,
                  body: { externalId: importId.trim() },
                });
                setLastResult(result);
                setImportId('');
              },
              { successMessage: t('imported') },
            )
          }
        >
          {t('import')}
        </Button>
      </section>

      <section className="space-y-3 rounded-card border border-border-subtle bg-surface p-4">
        <h2 className="font-semibold">{t('importByNameTitle')}</h2>
        <p className="text-sm text-content-muted">{t('importByNameHelp')}</p>
        <Label htmlFor="igdb-name">{t('importNameLabel')}</Label>
        <Input
          id="igdb-name"
          value={importName}
          onChange={(event) => setImportName(event.target.value)}
          placeholder="Elden Ring"
        />
        <Button
          disabled={isBusy() || importName.trim().length < 2}
          onClick={() =>
            void run(
              'import-name',
              async () => {
                const result = await apiFetch<ImportGameResultDto>('/admin/games/import/search', {
                  method: 'POST',
                  accessToken,
                  body: { name: importName.trim() },
                });
                setLastResult(result);
                setImportName('');
              },
              { successMessage: t('imported') },
            )
          }
        >
          {t('importByName')}
        </Button>
      </section>

      {lastResult ? (
        <div className="rounded-card border border-positive/30 bg-positive-soft p-4 text-sm">
          <p className="font-medium text-positive">
            {lastResult.created ? t('importCreated') : t('importExisting')}: {lastResult.name}
          </p>
          <Link href={`/games/${lastResult.slug}`} className="mt-1 inline-block text-brand underline">
            /games/{lastResult.slug}
          </Link>
          {lastResult.warnings.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-content-muted">
              {lastResult.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
