import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        variant === 'primary' && 'bg-brand text-brand-contrast hover:bg-brand-hover',
        variant === 'secondary' && 'border border-border-strong hover:bg-surface-hover',
        variant === 'ghost' && 'hover:bg-surface-hover',
        variant === 'danger' && 'bg-negative text-white hover:opacity-90',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
