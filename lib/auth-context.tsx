'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import type { Database } from './supabase/types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  authState: AuthState;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  authState: 'loading',
  signOut: async () => {},
  refreshSession: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');

  const fetchProfileForUser = useCallback(async (userId: string) => {
    try {
      const { data, error } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setProfile(data as ProfileRow);
        return data as ProfileRow;
      }
    } catch (e) {
      console.error('Error fetching profile in AuthProvider:', e);
    }
    return null;
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data?.session) {
          setSession(null);
          setProfile(null);
          setAuthState('unauthenticated');
        } else {
          setSession(data.session);
          setAuthState('authenticated');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setAuthState('unauthenticated');
      });

    // Listen for auth changes - keep lightweight & decoupled from db queries
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setAuthState(currentSession ? 'authenticated' : 'unauthenticated');
      if (!currentSession) {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile whenever authenticated user ID changes
  useEffect(() => {
    let mounted = true;
    const userId = session?.user?.id;
    if (userId) {
      fetchProfileForUser(userId).then((p) => {
        if (mounted && p) {
          setProfile(p);
        }
      });
    } else {
      setProfile(null);
    }
    return () => {
      mounted = false;
    };
  }, [session?.user?.id, fetchProfileForUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setAuthState('unauthenticated');
  }, []);

  const refreshProfile = useCallback(async () => {
    let currentUserId = session?.user?.id;
    if (!currentUserId) {
      const { data } = await supabase.auth.getSession();
      currentUserId = data.session?.user?.id;
    }
    if (currentUserId) {
      await fetchProfileForUser(currentUserId);
    } else {
      setProfile(null);
    }
  }, [session, fetchProfileForUser]);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        setSession(null);
        setProfile(null);
        setAuthState('unauthenticated');
      } else {
        setSession(data.session);
        setAuthState('authenticated');
        if (data.session.user?.id) {
          await fetchProfileForUser(data.session.user.id);
        }
      }
    } catch {
      setSession(null);
      setProfile(null);
      setAuthState('unauthenticated');
    }
  }, [fetchProfileForUser]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        authState,
        signOut,
        refreshSession,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
