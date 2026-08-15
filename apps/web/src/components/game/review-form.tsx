'use client';

import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import type { CreateReviewRequest, PlatformDto, ReviewDto } from '@gamescore/types';

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

function textValidationCopy(locale: string, min: number) {
  if (locale.startsWith('en')) {
    return {
      hint: `At least ${min} characters.`,
      required: 'Please write your review.',
      tooShort: `Reviews need at least ${min} characters.`,
    };
  }
  return {
    hint: `Mínimo de ${min} caracteres.`,
    required: 'Escreva sua avaliação.',
    tooShort: `A avaliação precisa ter pelo menos ${min} caracteres.`,
  };
}

export function ReviewForm({
  slug,
  externalId,
  platforms,
  onCreated,
}: {
  slug?: string;
  /** When set, first review imports the IGDB game into the catalogue. */
  externalId?: string;
  platforms: PlatformDto[];
  onCreated: (review: ReviewDto) => void;
}) {
  const t = useTranslations('reviews');
  const errors = useTranslations('errors');
  const locale = useLocale();
  const textCopy = textValidationCopy(locale, MIN_TEXT);
  const { accessToken } = useAuth();
  const toast = useToast();
  const form = useForm<FormValues>({
    defaultValues: {
      recommended: 'yes',
      text: '',
      rating: '',
      hoursPlayed: '',
      platformId: '',
    },
  });

  async function onSubmit(values: FormValues) {
    if (!accessToken) {
      toast.push(errors('UNAUTHORIZED'), 'error');
      return;
    }
    const payload: CreateReviewRequest = {
      recommended: values.recommended === 'yes',
      text: values.text,
      rating: values.rating ? Number(values.rating) : null,
      hoursPlayed: values.hoursPlayed ? Number(values.hoursPlayed) : null,
      platformId: values.platformId || null,
    };
    const path = externalId
      ? `/games/external/${externalId}/reviews`
      : `/games/${slug}/reviews`;
    try {
      const review = await apiFetch<ReviewDto>(path, { method: 'POST', accessToken, body: payload });
      toast.push(t('published'), 'success');
      form.reset();
      onCreated(review);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    }
  }

  const textError = form.formState.errors.text;

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
        <Textarea
          id="text"
          rows={5}
          aria-invalid={Boolean(textError)}
          {...form.register('text', {
            required: textCopy.required,
            minLength: { value: MIN_TEXT, message: textCopy.tooShort },
          })}
        />
        <p className="mt-1 text-xs text-content-subtle">{textCopy.hint}</p>
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
