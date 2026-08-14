'use client';

import type { ReviewDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';

export function ReviewCard({
  review,
  onChanged,
}: {
  review: ReviewDto;
  onChanged?: () => void;
}) {
  const t = useTranslations('reviews');
  const errors = useTranslations('errors');
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [details, setDetails] = useState('');

  async function vote(useful: boolean) {
    try {
      await apiFetch(`/reviews/${review.id}/vote`, {
        method: 'POST',
        accessToken,
        body: { useful },
      });
      onChanged?.();
    } catch (error) {
      toast.push(error instanceof Error ? errors((error as { code?: string }).code ?? 'INTERNAL_ERROR') : t('voteError'), 'error');
    }
  }

  async function report() {
    try {
      await apiFetch(`/reviews/${review.id}/report`, {
        method: 'POST',
        accessToken,
        body: { reason: 'SPAM', details },
      });
      setReportOpen(false);
      toast.push(t('reportThanks'), 'success');
      onChanged?.();
    } catch {
      toast.push(t('reportError'), 'error');
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={review.author.displayName || review.author.username} src={review.author.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profile/${review.author.username}`} className="font-medium hover:underline">
              {review.author.displayName || review.author.username}
            </Link>
            <Badge tone={review.recommended ? 'positive' : 'negative'}>
              {review.recommended ? t('recommended') : t('notRecommended')}
            </Badge>
            {review.edited ? <span className="text-xs text-content-subtle">{t('edited')}</span> : null}
          </div>
          <p className="mt-1 text-xs text-content-subtle">
            {new Date(review.createdAt).toLocaleDateString()}
            {review.hoursPlayed != null ? ` · ${review.hoursPlayed}h` : ''}
            {review.platform ? ` · ${review.platform.abbreviation}` : ''}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{review.text}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={review.viewerVote === 'USEFUL' ? 'primary' : 'secondary'} onClick={() => vote(true)} disabled={!user}>
              {t('useful')} ({review.usefulCount})
            </Button>
            <Button
              size="sm"
              variant={review.viewerVote === 'NOT_USEFUL' ? 'primary' : 'secondary'}
              onClick={() => vote(false)}
              disabled={!user}
            >
              {t('notUseful')} ({review.notUsefulCount})
            </Button>
            {user && !review.viewerIsAuthor && !review.viewerHasReported ? (
              <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
                {t('report')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <Modal open={reportOpen} title={t('reportTitle')} onClose={() => setReportOpen(false)}>
        <Textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={4} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReportOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void report()}>{t('submitReport')}</Button>
        </div>
      </Modal>
    </Card>
  );
}
