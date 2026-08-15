'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { CreateReviewRequest, PlatformDto, ReviewDto, UpdateReviewRequest } from '@gamescore/types';

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

const MIN_TEXT = 20;

export function ReviewForm({
  slug,
  externalId,
  platforms,
  existing,
  onSaved,
  onCancel,
}: {
  slug?: string;
  /** When set, first review imports the IGDB game into the catalogue. */
  externalId?: string;
  platforms: PlatformDto[];
  existing?: ReviewDto;
  onSaved: (review: ReviewDto) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('reviews');
  const errors = useTranslations('errors');
  const { accessToken } = useAuth();
  const toast = useToast();
  const form = useForm<FormValues>({
    defaultValues: {
      recommended: existing ? (existing.recommended ? 'yes' : 'no') : 'yes',
      text: existing?.text ?? '',
      rating: existing?.rating != null ? String(existing.rating) : '',
      hoursPlayed: existing?.hoursPlayed != null ? String(existing.hoursPlayed) : '',
      platformId: existing?.platform?.id ?? '',
    },
  });

  async function onSubmit(values: FormValues) {
    if (!accessToken) {
      toast.push(errors('UNAUTHORIZED'), 'error');
      return;
    }
    const payload: CreateReviewRequest | UpdateReviewRequest = {
      recommended: values.recommended === 'yes',
      text: values.text,
      rating: values.rating ? Number(values.rating) : null,
      hoursPlayed: values.hoursPlayed ? Number(values.hoursPlayed) : null,
      platformId: values.platformId || null,
    };
    try {
      const review = existing
        ? await apiFetch<ReviewDto>(`/reviews/${existing.id}`, {
            method: 'PATCH',
            accessToken,
            body: payload,
          })
        : await apiFetch<ReviewDto>(
            externalId ? `/games/external/${externalId}/reviews` : `/games/${slug}/reviews`,
            { method: 'POST', accessToken, body: payload },
          );
      toast.push(existing ? t('updated') : t('published'), 'success');
      if (!existing) form.reset();
      onSaved(review);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    }
  }

  const textError = form.formState.errors.text;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 rounded-card border border-border-subtle bg-surface p-4"
    >
      <h3 className="font-semibold">{existing ? t('editTitle') : t('writeTitle')}</h3>
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
        <Textarea
          id="text"
          rows={5}
          aria-invalid={Boolean(textError)}
          {...form.register('text', {
            required: t('textRequired'),
            minLength: { value: MIN_TEXT, message: t('textTooShort', { min: MIN_TEXT }) },
          })}
        />
        <p className="mt-1 text-xs text-content-subtle">{t('textHint', { min: MIN_TEXT })}</p>
        {textError?.message ? (
          <p className="mt-1 text-xs text-danger" role="alert">
            {textError.message}
          </p>
        ) : null}
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
            aria-label={t('platformLabel')}
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {existing ? t('saveEdit') : t('submit')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
