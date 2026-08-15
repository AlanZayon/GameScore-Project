'use client';

import type { AuthenticatedUser, AuthSessionResponse } from '@gamescore/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiFetch, ApiError, setAccessTokenRefresher } from '@/lib/api';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
    acceptedTerms: true;
  }) => Promise<void>;
  logout: () => Promise<void>;
  applyUser: (user: AuthenticatedUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Refresh-token rotation must not run twice in parallel. React Strict Mode
 * remounts effects in development; a second call with the already-rotated
 * cookie would revoke every session for the account.
 */
let refreshInFlight: Promise<AuthSessionResponse> | null = null;

function refreshSession(): Promise<AuthSessionResponse> {
  if (!refreshInFlight) {
    refreshInFlight = apiFetch<AuthSessionResponse>('/auth/refresh', { method: 'POST' }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

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
        const session = await refreshSession();
        if (!cancelled) applySession(session);
      } catch (error) {
        // No session, expired cookie, or API briefly unreachable during restart.
        const isExpectedAuthMiss =
          (error instanceof ApiError && (error.status === 401 || error.status === 403)) ||
          (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message));
        if (!isExpectedAuthMiss) {
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

  useEffect(() => {
    setAccessTokenRefresher(async () => {
      try {
        const session = await refreshSession();
        applySession(session);
        return session.accessToken;
      } catch {
        setAccessToken(null);
        setUser(null);
        return null;
      }
    });
    return () => setAccessTokenRefresher(null);
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
    async (input: {
      email: string;
      username: string;
      password: string;
      displayName?: string;
      acceptedTerms: true;
    }) => {
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

  const applyUser = useCallback((next: AuthenticatedUser) => {
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, ready, login, register, logout, applyUser }),
    [user, accessToken, ready, login, register, logout, applyUser],
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
