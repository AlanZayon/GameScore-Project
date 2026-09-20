'use client';

import type { GameSummaryDto } from '@gamescore/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GamePoster } from '@/components/game/game-card';
import { EmptyState } from '@/components/ui/misc';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const EDGE = 8;

export function PosterRail({
  title,
  seeAllHref,
  seeAllLabel,
  empty,
  games,
  priorityFirst,
}: {
  title: string;
  seeAllHref: string;
  seeAllLabel: string;
  empty: string;
  games: GameSummaryDto[];
  priorityFirst?: boolean;
}) {
  const common = useTranslations('common');
  const scroller = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= EDGE) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }

    setCanPrev(el.scrollLeft > EDGE);
    setCanNext(el.scrollLeft < maxScroll - EDGE);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    updateEdges();
    // Re-check after images/layout settle.
    const raf = requestAnimationFrame(updateEdges);
    const t = window.setTimeout(updateEdges, 120);

    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      el.removeEventListener('scroll', updateEdges);
      ro.disconnect();
    };
  }, [games, updateEdges]);

  function scrollByPage(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= EDGE) return;

    const page = Math.max(el.clientWidth * 0.8, 200);
    const next = Math.min(maxScroll, Math.max(0, el.scrollLeft + page * direction));
    el.scrollTo({ left: next, behavior: 'smooth' });
  }

  return (
    <section className="space-y-3">
      <div className="container-page flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        <Link href={seeAllHref} className="shrink-0 text-sm font-medium text-brand hover:underline">
          {seeAllLabel}
        </Link>
      </div>
      {games.length === 0 ? (
        <div className="container-page">
          <EmptyState title={empty} />
        </div>
      ) : (
        <div className="container-page">
          <div className="relative">
            {canPrev ? (
              <button
                type="button"
                aria-label={common('previous')}
                onClick={() => scrollByPage(-1)}
                className={cn(
              'absolute left-0 top-[6.25rem] z-20 flex h-10 w-10 -translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface text-content shadow-md transition sm:top-[7.5rem] md:top-[8.25rem]',
              'hover:bg-surface-hover active:bg-surface-hover',
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
            ) : null}
            {canNext ? (
              <button
                type="button"
                aria-label={common('next')}
                onClick={() => scrollByPage(1)}
                className={cn(
                  'absolute right-0 top-[6.25rem] z-20 flex h-10 w-10 translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface text-content shadow-md transition sm:top-[7.5rem] md:top-[8.25rem]',
                  'hover:bg-surface-hover active:bg-surface-hover',
                )}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            <ul
              ref={scroller}
              className={cn(
                'flex touch-pan-x items-start gap-3 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-proximity',
                'py-1',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              )}
            >
              {games.map((game, index) => (
                <li key={game.id} className="shrink-0 snap-start">
                  <GamePoster game={game} priority={Boolean(priorityFirst && index === 0)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
