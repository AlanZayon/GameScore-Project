'use client';

import type { PlatformDto, ReviewDto } from '@gamescore/types';
import { REPORT_REASONS, type ReportReason } from '@gamescore/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ReviewForm } from '@/components/game/review-form';
import { GameCover } from '@/components/game/game-cover';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Label, Textarea } from '@/components/ui/input';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { loginPath } from '@/lib/safe-next';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { cn } from '@/lib/cn';

export function ReviewCard({
  review,
  platforms,
  showGame = false,
  onChanged,
}: {
  review: ReviewDto;
  platforms?: PlatformDto[];
  showGame?: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations('reviews');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const reasonsT = useTranslations('admin.reasons');
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState('');
  const [reason, setReason] = useState<ReportReason>('SPAM');
  const [busy, setBusy] = useState(false);

  const next = loginPath(pathname);

  async function vote(useful: boolean) {
    if (!user) {
      router.push(next);
      return;
    }
    try {
      const active =
        (useful && review.viewerVote === 'USEFUL') || (!useful && review.viewerVote === 'NOT_USEFUL');
      if (active) {
        await apiFetch(`/reviews/${review.id}/vote`, { method: 'DELETE', accessToken });
      } else {
        await apiFetch(`/reviews/${review.id}/vote`, {
          method: 'POST',
          accessToken,
          body: { useful },
        });
      }
      onChanged?.();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : t('voteError'), 'error');
    }
  }

  async function report() {
    try {
      await apiFetch(`/reviews/${review.id}/report`, {
        method: 'POST',
        accessToken,
        body: { reason, details: details.trim() || undefined },
      });
      setReportOpen(false);
      toast.push(t('reportThanks'), 'success');
      onChanged?.();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : t('reportError'), 'error');
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/reviews/${review.id}`, { method: 'DELETE', accessToken, body: {} });
      setDeleteOpen(false);
      toast.push(t('deleted'), 'success');
      onChanged?.();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (editing && platforms) {
    return (
      <ReviewForm
        existing={review}
        platforms={platforms}
        onSaved={() => {
          setEditing(false);
          onChanged?.();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Card className={cn('p-4', review.viewerIsAuthor && 'border-brand/40')}>
      {showGame ? (
        <Link
          href={`/games/${review.game.slug}`}
          className="mb-3 flex items-center gap-3 rounded-lg hover:bg-surface-hover"
        >
          <GameCover
            name={review.game.name}
            src={review.game.coverImageUrl}
            className="h-12 w-9 shrink-0 rounded-md"
            sizes="36px"
          />
          <span className="truncate font-medium">{review.game.name}</span>
        </Link>
      ) : null}
      <div className="flex items-start gap-3">
        <Avatar
          name={review.author.deleted ? t('deletedAuthor') : review.author.displayName || review.author.username}
          src={review.author.deleted ? null : review.author.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {review.author.deleted ? (
              <span className="font-medium text-content-muted">{t('deletedAuthor')}</span>
            ) : (
              <Link href={`/profile/${review.author.username}`} className="font-medium hover:underline">
                {review.author.displayName || review.author.username}
              </Link>
            )}
            {review.viewerIsAuthor ? <Badge tone="brand">{t('yourReview')}</Badge> : null}
            <Badge tone={review.recommended ? 'positive' : 'negative'}>
              {review.recommended ? t('recommended') : t('notRecommended')}
            </Badge>
            {review.rating != null ? (
              <span className="text-xs text-content-subtle">{t('ratingValue', { rating: review.rating })}</span>
            ) : null}
            {review.edited ? <span className="text-xs text-content-subtle">{t('edited')}</span> : null}
          </div>
          <p className="mt-1 text-xs text-content-subtle">
            {new Date(review.createdAt).toLocaleDateString()}
            {review.hoursPlayed != null ? ` · ${review.hoursPlayed}h` : ''}
            {review.platform ? ` · ${review.platform.abbreviation}` : ''}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{review.text}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={review.viewerVote === 'USEFUL' ? 'primary' : 'secondary'}
              onClick={() => void vote(true)}
              title={!user ? t('loginToVote') : undefined}
            >
              {t('useful')} ({review.usefulCount})
            </Button>
            <Button
              size="sm"
              variant={review.viewerVote === 'NOT_USEFUL' ? 'primary' : 'secondary'}
              onClick={() => void vote(false)}
              title={!user ? t('loginToVote') : undefined}
            >
              {t('notUseful')} ({review.notUsefulCount})
            </Button>
            {user && !review.viewerIsAuthor && !review.viewerHasReported ? (
              <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
                {t('report')}
              </Button>
            ) : null}
            {review.viewerIsAuthor ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={!platforms}>
                  {common('edit')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
                  {common('delete')}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <Modal open={reportOpen} title={t('reportTitle')} onClose={() => setReportOpen(false)}>
        <div className="space-y-3">
          <div>
            <Label htmlFor="report-reason">{t('reportReason')}</Label>
            <select
              id="report-reason"
              className="w-full rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
            >
              {REPORT_REASONS.map((item) => (
                <option key={item} value={item}>
                  {reasonsT(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="report-details">{t('reportDetails')}</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReportOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void report()}>{t('submitReport')}</Button>
        </div>
      </Modal>
      <Modal open={deleteOpen} title={t('deleteTitle')} onClose={() => setDeleteOpen(false)}>
        <p className="text-sm text-content-muted">{t('deleteBody')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            {t('cancel')}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>
            {common('delete')}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
