import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import type { DashboardData } from '../types';

interface PosState {
  dashboardData: DashboardData | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncPosDashboard: () => Promise<void>;
  deltaSync: () => Promise<void>;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      dashboardData: null,
      isSyncing: false,
      lastSyncedAt: null,

      syncPosDashboard: async () => {
        set({ isSyncing: true });
        try {
          const res = await api.get<DashboardData>('/inventory/dashboard');
          set({
            dashboardData: res.data,
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('[PosStore] Full dashboard sync error:', error);
        } finally {
          set({ isSyncing: false });
        }
      },

      deltaSync: async () => {
        // Delta sync via Supabase has been entirely removed as part of the migration
        // to a standalone PostgreSQL + NestJS architecture.
      },
    }),
    {
      name: 'techbill-pos-cache',
      partialize: (state) => ({
        dashboardData: state.dashboardData,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
