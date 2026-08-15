'use client';

import type { CursorPaginatedResponse, ReviewDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ReviewCard } from '@/components/game/review-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { apiFetch, qs } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';

export function ProfileReviews({
  username,
  initial,
}: {
  username: string;
  initial: CursorPaginatedResponse<ReviewDto>;
}) {
  const t = useTranslations('profile');
  const common = useTranslations('common');
  const { accessToken } = useAuth();
  const [reviews, setReviews] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function reload() {
    const next = await apiFetch<CursorPaginatedResponse<ReviewDto>>(
      `/users/${username}/reviews${qs({ limit: 20 })}`,
      { accessToken },
    );
    setReviews(next);
  }

  async function loadMore() {
    if (!reviews.meta.nextCursor) return;
    setLoading(true);
    try {
      const next = await apiFetch<CursorPaginatedResponse<ReviewDto>>(
        `/users/${username}/reviews${qs({ limit: 20, cursor: reviews.meta.nextCursor })}`,
        { accessToken },
      );
      setReviews({
        items: [...reviews.items, ...next.items],
        meta: next.meta,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{t('recentReviews')}</h2>
      {reviews.items.length === 0 ? (
        <EmptyState title={t('emptyReviews')} />
      ) : (
        reviews.items.map((review) => (
          <ReviewCard key={review.id} review={review} showGame onChanged={() => void reload()} />
        ))
      )}
      {reviews.meta.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="secondary" disabled={loading} onClick={() => void loadMore()}>
            {common('loadMore')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
