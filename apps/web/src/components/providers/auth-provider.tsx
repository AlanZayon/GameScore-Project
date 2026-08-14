'use client';

import type { AuthenticatedUser, AuthSessionResponse } from '@gamescore/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiFetch, ApiError } from '@/lib/api';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: { email: string; username: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback((session: AuthSessionResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await apiFetch<AuthSessionResponse>('/auth/refresh', { method: 'POST' });
        if (!cancelled) applySession(session);
      } catch (error) {
        if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
          console.error(error);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const session = await apiFetch<AuthSessionResponse>('/auth/login', {
        method: 'POST',
        body: { identifier, password },
      });
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: { email: string; username: string; password: string; displayName?: string }) => {
      const session = await apiFetch<AuthSessionResponse>('/auth/register', {
        method: 'POST',
        body: input,
      });
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, ready, login, register, logout }),
    [user, accessToken, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
