import { cn } from '@/lib/cn';

/** Base shimmer block. Prefer composed skeletons below for page layouts. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-md', className ?? 'h-4 w-full')} aria-hidden />;
}

export function GameCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full overflow-hidden rounded-card border border-border-subtle bg-surface',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-28 w-20 shrink-0 rounded-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        <Skeleton className="h-4 w-[75%]" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-auto flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

export function GameRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 border-b border-border-subtle px-1 py-2',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-11 w-8 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-10" />
    </div>
  );
}

export function GameCardGridSkeleton({
  count = 8,
  columns = 'home',
}: {
  count?: number;
  columns?: 'home' | 'catalog' | 'rankings';
}) {
  const grid =
    columns === 'catalog'
      ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'
      : columns === 'rankings'
        ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={grid} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <GameCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function GameRowListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col border-t border-border-subtle" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <GameRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      {withSubtitle ? <Skeleton className="h-4 w-80 max-w-full" /> : null}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <main className="container-page space-y-8 py-6" aria-busy="true" aria-live="polite">
      <section className="space-y-3">
        <Skeleton className="h-5 w-full max-w-xl" />
        <Skeleton className="h-10 w-full max-w-lg rounded-md md:hidden" />
        <Skeleton className="h-3 w-48" />
      </section>
      {Array.from({ length: 3 }).map((_, section) => (
        <section key={section} className="space-y-3">
          <div className="flex items-end justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <GameRowListSkeleton count={4} />
        </section>
      ))}
    </main>
  );
}

export function CatalogPageSkeleton() {
  return (
    <main className="container-page space-y-5 py-6" aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <GameRowListSkeleton count={9} />
    </main>
  );
}

export function GameDetailSkeleton() {
  return (
    <main className="container-page space-y-6 py-6" aria-busy="true" aria-live="polite">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="flex gap-4">
            <Skeleton className="h-40 w-28 shrink-0 rounded-card" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-[66%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[83%]" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          </div>
          <Skeleton className="h-36 w-full rounded-card lg:hidden" />
          <Skeleton className="h-40 w-full rounded-card" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-card" />
            ))}
          </div>
        </div>
        <aside className="hidden space-y-3 lg:block">
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
        </aside>
      </div>
    </main>
  );
}

export function RankingsPageSkeleton() {
  return (
    <main className="container-page space-y-5 py-6" aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-0.5 rounded-md border border-border-subtle bg-surface p-0.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <GameRowListSkeleton count={8} />
    </main>
  );
}

export function SearchPageSkeleton() {
  return (
    <main className="container-page space-y-5 py-6" aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton withSubtitle={false} />
      <Skeleton className="h-4 w-64" />
      <GameRowListSkeleton count={6} />
    </main>
  );
}

export function ProfilePageSkeleton() {
  return (
    <main className="container-page space-y-6 py-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-y border-border-subtle py-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-card" />
        ))}
      </div>
    </main>
  );
}

export function AdminPageSkeleton() {
  return (
    <main className="container-page space-y-5 py-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-wrap gap-0.5 rounded-md border border-border-subtle bg-surface p-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-20 rounded-md" />
        ))}
      </div>
      <div className="space-y-0 border-y border-border-subtle divide-y divide-border-subtle">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex justify-between py-2.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function AuthFormSkeleton() {
  return (
    <main className="container-page flex max-w-md flex-col gap-5 py-12" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-44" />
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </main>
  );
}

export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index}>
          <Skeleton className="h-20 w-full rounded-card" />
        </li>
      ))}
    </ul>
  );
}
