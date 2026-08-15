'use client';

import { useState, type ReactNode } from 'react';

export function Dropdown({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl border border-border-subtle bg-surface-raised p-1 shadow-lg">
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
    <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
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
  return <div className={`skeleton-shimmer rounded-lg ${className ?? 'h-4 w-full'}`} aria-hidden />;
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
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-lg border border-border-strong px-3 py-1.5 text-sm disabled:opacity-40"
      >
        ←
      </button>
      <span className="text-sm text-content-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded-lg border border-border-strong px-3 py-1.5 text-sm disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-content-muted">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div className="rounded-card border border-negative/30 bg-negative-soft px-6 py-8 text-center">
      <p className="font-medium text-negative">{title}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-3 text-sm underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}
