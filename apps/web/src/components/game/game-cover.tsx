'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { isOptimizableCoverUrl, isRemoteCoverUrl, upgradeIgdbCoverUrl } from '@/lib/cover-image';

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
        'flex h-full w-full flex-col items-center justify-center bg-surface-hover px-2 text-center',
        className,
      )}
      aria-hidden
    >
      <span className="font-display text-2xl font-semibold tracking-tight text-content-muted">
        {initials || 'GS'}
      </span>
      <span className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-content-subtle">{name}</span>
    </div>
  );
}

export function GameCover({
  name,
  src,
  className,
  imgClassName,
  sizes = '112px',
  priority = false,
}: {
  name: string;
  src: string | null | undefined;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const remote = isRemoteCoverUrl(src) ? upgradeIgdbCoverUrl(src) : null;
  const [failed, setFailed] = useState(false);
  const optimizable = remote !== null && isOptimizableCoverUrl(remote);

  return (
    <div className={cn('relative overflow-hidden bg-surface-raised', className)}>
      {remote && !failed ? (
        optimizable ? (
          <Image
            src={remote}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className={cn('object-cover object-center', imgClassName)}
            onError={() => setFailed(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={remote}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            className={cn('absolute inset-0 h-full w-full object-cover object-center', imgClassName)}
            onError={() => setFailed(true)}
          />
        )
      ) : (
        <CoverFallback name={name} className="absolute inset-0" />
      )}
    </div>
  );
}
