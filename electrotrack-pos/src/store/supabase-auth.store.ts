/**
 * Supabase Auth store — use this instead of auth.store.ts when running
 * Supabase Auth (not custom NestJS JWT).
 *
 * Supabase SDK owns token storage (localStorage under 'et-session').
 * Zustand only caches the lightweight app-level profile for fast initial render.
 * Never store access_token in Zustand — Supabase handles silent refresh.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  permissions: string[];
}

interface AuthState {
  session: Session | null;
  user: User | null;
  /** Cached app-level profile (from user_metadata or a profiles table) */
  profile: UserProfile | null;
  /** True once getSession() has resolved — prevents redirect flicker */
  isReady: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  markReady: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      profile: null,
      isReady: false,

      setSession: (session) =>
        set({ session, user: session?.user ?? null }),

      setProfile: (profile) => set({ profile }),

      markReady: () => set({ isReady: true }),

      // Called on logout — clears all derived state
      reset: () => set({ session: null, user: null, profile: null }),
    }),
    {
      name: 'et-auth-meta',
      storage: createJSONStorage(() => localStorage),
      // Only persist profile metadata — NOT session tokens
      // Supabase SDK persists the actual JWT under its own key ('et-session')
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
