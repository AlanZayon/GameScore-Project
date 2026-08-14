'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readTheme(): Theme {
  const stored = window.localStorage.getItem('gs-theme');
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as const);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem('gs-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    emit();
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
