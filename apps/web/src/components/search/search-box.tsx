'use client';

import type { AutocompleteItemDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { GameCover } from '@/components/game/game-cover';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';
import { Input } from '@/components/ui/input';

function suggestionHref(item: AutocompleteItemDto): string {
  if (item.slug) return `/games/${item.slug}`;
  if (item.externalId) return `/games/ext/${item.externalId}`;
  return '/search';
}

export function SearchBox({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AutocompleteItemDto[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void apiFetch<AutocompleteItemDto[]>(`/search/autocomplete${qs({ q: query, limit: 8 })}`).then(
        (result) => {
          setItems(result);
          setOpen(true);
        },
      );
    }, 220);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  const suggestions = query.trim().length < 2 ? [] : items;

  return (
    <form
      className={`relative ${className ?? ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) {
          setOpen(false);
          router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
      }}
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-lg">
          {suggestions.map((item) => (
            <li key={item.id}>
              <Link
                href={suggestionHref(item)}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover"
                onClick={() => setOpen(false)}
              >
                <GameCover
                  name={item.name}
                  src={item.coverImageUrl}
                  className="h-10 w-8 shrink-0 rounded-md"
                  sizes="32px"
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.releaseYear ? (
                  <span className="shrink-0 text-xs text-content-subtle">{item.releaseYear}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
