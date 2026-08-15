'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';
import { isRemoteCoverUrl } from '@/lib/cover-image';

function CoverFallback({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/[\s:_'-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#141922] via-[#1b2230] to-[#2a1f4d] px-2 text-center',
        className,
      )}
      aria-hidden
    >
      <span className="text-3xl font-bold tracking-tight text-brand">{initials || 'GS'}</span>
      <span className="mt-2 line-clamp-2 text-[10px] leading-tight text-content-subtle">{name}</span>
    </div>
  );
}

export function GameCover({
  name,
  src,
  className,
  imgClassName,
}: {
  name: string;
  src: string | null | undefined;
  className?: string;
  imgClassName?: string;
}) {
  const remote = isRemoteCoverUrl(src) ? src : null;
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-surface-raised', className)}>
      {remote && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={remote}
          alt=""
          className={cn('h-full w-full object-cover', imgClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <CoverFallback name={name} />
      )}
    </div>
  );
}
