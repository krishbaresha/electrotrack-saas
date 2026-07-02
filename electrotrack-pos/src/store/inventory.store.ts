import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import type { SearchProduct } from '../components/pos/UniversalSearch';

interface InventoryState {
  products: SearchProduct[];
  isSyncing: boolean;
  lastSynced: number | null;
  syncProducts: () => Promise<void>;
  clearCache: () => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      products: [],
      isSyncing: false,
      lastSynced: null,
      syncProducts: async () => {
        set({ isSyncing: true });
        try {
          const res = await api.get<{ data: SearchProduct[] } | SearchProduct[]>('/inventory/products');
          const d = res.data;
          const list = Array.isArray(d) ? d : (d as { data: SearchProduct[] }).data ?? [];
          set({ products: list, isSyncing: false, lastSynced: Date.now() });
        } catch (err) {
          set({ isSyncing: false });
        }
      },
      clearCache: () => set({ products: [], lastSynced: null }),
    }),
    {
      name: 'electrotrack-inventory-cache',
    }
  )
);
