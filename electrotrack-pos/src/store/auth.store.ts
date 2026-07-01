import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrating: boolean;
  _hasHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken?: string | null) => void;
  setToken: (token: string, refreshToken?: string | null) => void;
  clearAuth: () => void;
  setHydrating: (v: boolean) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrating: true,
      _hasHydrated: false,
      setAuth: (user, accessToken, refreshToken = null) =>
        set({ user, accessToken, refreshToken, isHydrating: false }),
      setToken: (token, refreshToken = null) => {
        const updates: Partial<AuthState> = { accessToken: token, isHydrating: false };
        if (refreshToken) updates.refreshToken = refreshToken;
        set(updates);
      },
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, isHydrating: false }),
      setHydrating: (v) => set({ isHydrating: v }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'et-auth',
      // Persist user and refreshToken — access token lives in memory only
      partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.setHasHydrated(true);
            state.setHydrating(false);
          }
        };
      },
    },
  ),
);
