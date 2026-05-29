/**
 * AuthProvider — must wrap the entire app (inside BrowserRouter).
 *
 * On mount it calls supabase.auth.getSession() to restore any existing
 * session from localStorage. This is what prevents the page-refresh login
 * redirect: by the time children render, isReady is true and session is
 * populated if the user was already authenticated.
 *
 * onAuthStateChange fires for every auth event (SIGNED_IN, SIGNED_OUT,
 * TOKEN_REFRESHED) and keeps the store in sync — no manual token refresh needed.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/supabase-auth.store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, markReady } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double-subscription in React StrictMode dev double-invoke
    if (initialized.current) return;
    initialized.current = true;

    // Restore session from SDK storage on page load.
    // Resolves immediately if a valid session exists (no network round-trip).
    // Only expired sessions trigger a silent token refresh here.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      markReady(); // unblocks ProtectedRoute — prevents redirect flicker
    });

    // Subscribe to all future auth events.
    // TOKEN_REFRESHED fires automatically ~55 min — no manual refresh needed.
    // SIGNED_OUT fires on signOut() or session expiry with no refresh token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        markReady();
      },
    );

    return () => subscription.unsubscribe();
  }, [setSession, markReady]);

  return <>{children}</>;
}
