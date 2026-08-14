'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { CreateReviewRequest, PlatformDto } from '@gamescore/types';

import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';

interface FormValues {
  recommended: 'yes' | 'no';
  text: string;
  rating: string;
  hoursPlayed: string;
  platformId: string;
}

export function ReviewForm({
  slug,
  platforms,
  onCreated,
}: {
  slug: string;
  platforms: PlatformDto[];
  onCreated: () => void;
}) {
  const t = useTranslations('reviews');
  const errors = useTranslations('errors');
  const { accessToken } = useAuth();
  const toast = useToast();
  const form = useForm<FormValues>({
    defaultValues: { recommended: 'yes', text: '', rating: '', hoursPlayed: '', platformId: platforms[0]?.id ?? '' },
  });

  async function onSubmit(values: FormValues) {
    const payload: CreateReviewRequest = {
      recommended: values.recommended === 'yes',
      text: values.text,
      rating: values.rating ? Number(values.rating) : null,
      hoursPlayed: values.hoursPlayed ? Number(values.hoursPlayed) : null,
      platformId: values.platformId || null,
    };
    try {
      await apiFetch(`/games/${slug}/reviews`, { method: 'POST', accessToken, body: payload });
      toast.push(t('published'), 'success');
      form.reset();
      onCreated();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors(code), 'error');
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-card border border-border-subtle bg-surface p-4">
      <h3 className="font-semibold">{t('writeTitle')}</h3>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" value="yes" {...form.register('recommended')} />
          {t('recommended')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" value="no" {...form.register('recommended')} />
          {t('notRecommended')}
        </label>
      </div>
      <div>
        <Label htmlFor="text">{t('textLabel')}</Label>
        <Textarea id="text" rows={5} {...form.register('text', { required: true, minLength: 20 })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="rating">{t('ratingLabel')}</Label>
          <Input id="rating" type="number" min={0} max={10} {...form.register('rating')} />
        </div>
        <div>
          <Label htmlFor="hours">{t('hoursLabel')}</Label>
          <Input id="hours" type="number" min={0} {...form.register('hoursPlayed')} />
        </div>
        <div>
          <Label htmlFor="platform">{t('platformLabel')}</Label>
          <select
            id="platform"
            className="w-full rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm"
            {...form.register('platformId')}
          >
            <option value="">{t('platformNone')}</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t('submit')}
      </Button>
    </form>
  );
}
