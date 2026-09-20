'use client';

import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

export function Dropdown({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerNode =
    isValidElement(trigger)
      ? cloneElement(trigger as ReactElement<{ 'aria-expanded'?: boolean }>, { 'aria-expanded': open })
      : trigger;

  return (
    <div className="relative" ref={root}>
      <div onClick={() => setOpen((value) => !value)}>{triggerNode}</div>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1.5 min-w-44 rounded-md border border-border-subtle bg-surface-raised p-1 shadow-md"
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-md border border-border-subtle bg-surface p-0.5" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-100 ${
            value === tab.id ? 'bg-brand text-brand-contrast' : 'text-content-muted hover:bg-surface-hover'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className ?? 'h-4 w-full'}`} aria-hidden />;
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations('common');
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label={t('previous')}
        className="min-h-9 rounded-md border border-border-strong px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {t('previous')}
      </button>
      <span className="score-num text-sm text-content-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label={t('next')}
        className="min-h-9 rounded-md border border-border-strong px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {t('next')}
      </button>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-content-muted">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  const t = useTranslations('common');
  return (
    <div className="rounded-card border border-negative/30 bg-negative-soft px-4 py-6 text-center">
      <p className="font-medium text-negative">{title}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-3 text-sm text-brand hover:underline">
          {t('errorRetry')}
        </button>
      ) : null}
    </div>
  );
}
