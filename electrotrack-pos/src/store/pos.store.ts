import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import type { DashboardData } from '../types';

interface PosState {
  dashboardData: DashboardData | null;
  isSyncing: boolean;
  syncPosDashboard: () => Promise<void>;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      dashboardData: null,
      isSyncing: false,
      
      syncPosDashboard: async () => {
        set({ isSyncing: true });
        try {
          const res = await api.get<DashboardData>('/inventory/dashboard');
          set({ dashboardData: res.data });
        } catch (error) {
          console.error("POS Dashboard sync error", error);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'electrotrack-pos-cache',
    }
  )
);
