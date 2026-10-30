import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DEMO_ID, clearDemoData } from '@/lib/data';

interface AppUser { id: string; email?: string }

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  /** True when running without Supabase: local-only demo data. */
  demo: boolean;
  configured: boolean;
  /** True after the user opened a password-reset email link. */
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, lang?: string) => Promise<{ error?: string; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  startDemo: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);
const DEMO_FLAG = 'sage.demo';

const toUser = (s: Session | null): AppUser | null => (s?.user ? { id: s.user.id, email: s.user.email ?? undefined } : null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      let on = false;
      try { on = localStorage.getItem(DEMO_FLAG) === '1'; } catch { /* ignore */ }
      setUser(on ? { id: DEMO_ID } : null);
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toUser(data.session));
      setLoading(false);
    }).catch(() => active && setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setUser(toUser(session));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return null;
    if (/confirm/i.test(error.message)) return 'Please verify your email first. Check your inbox for the confirmation link.';
    return error.message;
  }, []);

  const signUp = useCallback(async (email: string, password: string, lang = 'en') => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    // `lang` lands in user_metadata so the Resend-sent auth emails can be rendered in the right language.
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: `${window.location.origin}/app`, data: { lang } },
    });
    if (error) return { error: error.message };
    return { needsVerification: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    else { try { localStorage.removeItem(DEMO_FLAG); } catch { /* ignore */ } setUser(null); }
  }, []);

  const requestReset = useCallback(async (email: string) => {
    if (!supabase) return 'Supabase is not configured.';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    return error ? error.message : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return 'Supabase is not configured.';
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovery(false);
    return error ? error.message : null;
  }, []);

  const startDemo = useCallback(() => {
    if (isSupabaseConfigured) return;
    try { localStorage.setItem(DEMO_FLAG, '1'); } catch { /* ignore */ }
    setUser({ id: DEMO_ID });
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, loading, demo: !isSupabaseConfigured, configured: isSupabaseConfigured, recovery,
    signIn, signUp, signOut, requestReset, updatePassword, startDemo,
  }), [user, loading, recovery, signIn, signUp, signOut, requestReset, updatePassword, startDemo]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { clearDemoData };
