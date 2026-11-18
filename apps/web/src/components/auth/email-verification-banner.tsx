'use client';

import { useTranslations } from 'next-intl';

import { useAuth } from '@/components/providers/auth-provider';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const HIDDEN_PATHS = new Set(['/settings', '/verify-email']);

export function EmailVerificationBanner({
  className,
  compact = false,
}: {
  className?: string;
  /** Inline notice (e.g. above the review form) instead of the site-wide strip. */
  compact?: boolean;
}) {
  const t = useTranslations('auth');
  const { user, ready } = useAuth();
  const pathname = usePathname();

  if (!ready || !user || user.emailVerified) {
    return null;
  }

  if (!compact && HIDDEN_PATHS.has(pathname)) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        compact
          ? 'rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content-muted'
          : 'border-b border-border-subtle bg-surface-raised px-4 py-2.5 text-sm text-content-muted',
        className,
      )}
    >
      <div className={cn(!compact && 'container-page flex flex-wrap items-center gap-x-3 gap-y-1')}>
        <p className={cn(!compact && 'min-w-0 flex-1')}>
          {compact ? t('verifyCompactBanner') : t('verifySiteBanner')}{' '}
          <Link href="/settings" className="font-medium text-brand underline-offset-2 hover:underline">
            {t('verifySiteCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}
