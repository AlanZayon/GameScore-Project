'use client';

import type { AutocompleteItemDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';
import { Input } from '@/components/ui/input';

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
                href={`/games/${item.slug}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-surface-hover"
              >
                <span className="truncate">{item.name}</span>
                <span className="text-xs text-content-subtle">{item.releaseYear ?? ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
