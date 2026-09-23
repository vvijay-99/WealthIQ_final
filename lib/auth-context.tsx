'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase/client';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  authState: AuthState;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  authState: 'loading',
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data?.session) {
          setSession(null);
          setAuthState('unauthenticated');
        } else {
          setSession(data.session);
          setAuthState('authenticated');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setAuthState('unauthenticated');
      });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setAuthState(currentSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthState('unauthenticated');
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        setSession(null);
        setAuthState('unauthenticated');
      } else {
        setSession(data.session);
        setAuthState('authenticated');
      }
    } catch {
      setSession(null);
      setAuthState('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        authState,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
