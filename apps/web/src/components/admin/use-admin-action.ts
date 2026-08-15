'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api';

/**
 * Shared mutate helper for admin queues: catches ApiError (no Next runtime overlay),
 * toasts localized codes, and always allows a refetch callback — including after
 * conflicts like REPORT_ALREADY_RESOLVED so stale rows leave the UI.
 */
export function useAdminAction() {
  const toast = useToast();
  const errors = useTranslations('errors');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<unknown>,
      options: {
        successMessage: string;
        onSettled?: () => void | Promise<void>;
      },
    ) => {
      if (busyKey) return;
      setBusyKey(key);
      try {
        await action();
        toast.push(options.successMessage, 'success');
        await options.onSettled?.();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
        toast.push(errors.has(code) ? errors(code) : errors('INTERNAL_ERROR'), 'error');
        // Stale queue item: refresh so the row disappears even on conflict.
        if (
          error instanceof ApiError &&
          (error.code === 'REPORT_ALREADY_RESOLVED' ||
            error.code === 'REVIEW_NOT_FOUND' ||
            error.code === 'NOT_FOUND')
        ) {
          await options.onSettled?.();
        }
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, errors, toast],
  );

  return {
    run,
    busyKey,
    isBusy: (key?: string) => (key ? busyKey === key : busyKey !== null),
  };
}
