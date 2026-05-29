/**
 * useAuth — single hook for all auth state and actions.
 *
 * Components never import supabase or useAuthStore directly —
 * all auth concerns go through this hook, making testing and
 * future provider swaps easy.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore, type UserProfile } from '../store/supabase-auth.store';

export function useAuth() {
  const { session, user, profile, isReady, setProfile, reset } = useAuthStore();
  const navigate = useNavigate();

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();  // clears SDK localStorage
    reset();                        // clears Zustand profile cache
    navigate('/login', { replace: true });
  }, [navigate, reset]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.auth.updateUser({
      data: { ...user.user_metadata, ...updates },
    });
    if (error) throw error;
    setProfile({ ...profile, ...updates } as UserProfile);
  }, [user, profile, setProfile]);

  return {
    // State
    session,
    user,
    profile,
    isReady,
    isAuthenticated: !!session,
    accessToken: session?.access_token ?? null,

    // Derived helpers
    role: profile?.role ?? (user?.user_metadata?.role as string | undefined) ?? null,
    tenantId: profile?.tenantId ?? null,
    permissions: profile?.permissions ?? [],

    // Actions
    signInWithPassword,
    signInWithMagicLink,
    signOut,
    updateProfile,
  };
}
