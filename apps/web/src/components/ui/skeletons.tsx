import { cn } from '@/lib/cn';

/** Base shimmer block. Prefer composed skeletons below for page layouts. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-lg', className ?? 'h-4 w-full')} aria-hidden />;
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
      <Skeleton className="h-36 w-28 shrink-0 rounded-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <Skeleton className="h-5 w-[75%]" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-auto flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
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
      ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
      : columns === 'rankings'
        ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={grid} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <GameCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-56" />
      {withSubtitle ? <Skeleton className="h-4 w-80 max-w-full" /> : null}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <main className="container-page space-y-12 py-10" aria-busy="true" aria-live="polite">
      <section className="max-w-3xl space-y-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-36 rounded-lg" />
          <Skeleton className="h-11 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-64" />
      </section>
      {Array.from({ length: 3 }).map((_, section) => (
        <section key={section} className="space-y-4">
          <div className="flex items-end justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <GameCardGridSkeleton count={4} columns="home" />
        </section>
      ))}
    </main>
  );
}

export function CatalogPageSkeleton() {
  return (
    <main className="container-page space-y-6 py-10" aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <GameCardGridSkeleton count={9} columns="catalog" />
    </main>
  );
}

export function GameDetailSkeleton() {
  return (
    <main className="container-page space-y-8 py-8" aria-busy="true" aria-live="polite">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="flex gap-5">
            <Skeleton className="h-48 w-36 shrink-0 rounded-card" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-9 w-[66%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[83%]" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-card" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-40" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-card" />
            ))}
          </div>
        </div>
        <aside className="space-y-4">
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </aside>
      </div>
    </main>
  );
}

export function RankingsPageSkeleton() {
  return (
    <main className="container-page space-y-6 py-10" aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <GameCardGridSkeleton count={6} columns="rankings" />
    </main>
  );
}

export function SearchPageSkeleton() {
  return (
    <main className="container-page space-y-6 py-10" aria-busy="true" aria-live="polite">
      <PageHeaderSkeleton withSubtitle={false} />
      <Skeleton className="h-4 w-64" />
      <GameCardGridSkeleton count={6} columns="catalog" />
    </main>
  );
}

export function ProfilePageSkeleton() {
  return (
    <main className="container-page space-y-8 py-10" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-card" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-card" />
        ))}
      </div>
    </main>
  );
}

export function AdminPageSkeleton() {
  return (
    <main className="container-page space-y-6 py-10" aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-56" />
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-card" />
        ))}
      </div>
    </main>
  );
}

export function AuthFormSkeleton() {
  return (
    <main className="container-page flex max-w-md flex-col gap-6 py-16" aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-48" />
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </main>
  );
}

export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index}>
          <Skeleton className="h-24 w-full rounded-card" />
        </li>
      ))}
    </ul>
  );
}
