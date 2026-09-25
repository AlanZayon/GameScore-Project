'use client';

import type { AutocompleteItemDto } from '@gamescore/types';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import { GameCover } from '@/components/game/game-cover';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, qs } from '@/lib/api';
import { Input } from '@/components/ui/input';

function suggestionHref(item: AutocompleteItemDto): string {
  if (item.slug) return `/games/${item.slug}`;
  if (item.externalId) return `/games/ext/${item.externalId}`;
  return '/search';
}

export function SearchBox({
  className,
  initialQuery = '',
}: {
  className?: string;
  initialQuery?: string;
}) {
  const t = useTranslations('nav');
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<AutocompleteItemDto[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setItems([]);
      setActive(-1);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void apiFetch<AutocompleteItemDto[]>(`/search/autocomplete${qs({ q: query, limit: 8 })}`)
        .then((result) => {
          setItems(result);
          setOpen(result.length > 0);
          setActive(-1);
        })
        .catch(() => {
          setItems([]);
        });
    }, 220);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  const suggestions = query.trim().length < 2 ? [] : items;

  function goTo(item: AutocompleteItemDto) {
    setOpen(false);
    setActive(-1);
    router.push(suggestionHref(item));
  }

  return (
    <form
      className={`relative ${className ?? ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (active >= 0 && suggestions[active]) {
          goTo(suggestions[active]);
          return;
        }
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
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((value) => (value + 1) % suggestions.length);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => (value <= 0 ? suggestions.length - 1 : value - 1));
          }
          if (event.key === 'Enter' && active >= 0 && suggestions[active]) {
            event.preventDefault();
            goTo(suggestions[active]);
          }
          if (event.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border-subtle bg-surface-raised shadow-md"
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === active} id={`${listId}-${index}`}>
              <Link
                href={suggestionHref(item)}
                className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover ${
                  index === active ? 'bg-surface-hover' : ''
                }`}
                // Prevent input blur from unmounting the list before the click navigates.
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  goTo(item);
                }}
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
