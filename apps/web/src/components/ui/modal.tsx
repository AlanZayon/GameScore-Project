'use client';

import { useEffect, type ReactNode } from 'react';

import { Button } from './button';

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--gs-overlay)] p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-card border border-border-subtle bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            ×
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
