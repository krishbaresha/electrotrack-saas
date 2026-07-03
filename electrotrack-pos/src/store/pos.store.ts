import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import { supabase } from '../lib/supabase';
import type { DashboardData } from '../types';

interface PosState {
  dashboardData: DashboardData | null;
  isSyncing: boolean;
  /** ISO timestamp of the last successful delta sync heartbeat */
  lastSyncedAt: string | null;
  syncPosDashboard: () => Promise<void>;
  deltaSync: () => Promise<void>;
}

/**
 * Assembles a DashboardData structure locally from raw Supabase product rows,
 * completely bypassing the NestJS /inventory/dashboard endpoint.
 * Uses the same shape the backend returns to stay compatible with the store.
 */
function buildDashboardFromRows(rows: any[]): DashboardData {
  const LOW_STOCK_THRESHOLD = 2;
  const FAST_SELL_TOP_N = 10;
  const RECENTLY_ADDED_DAYS = 30;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENTLY_ADDED_DAYS);

  const categories = [...new Set(rows.map((r: any) => r.category).filter(Boolean))] as string[];

  const toCard = (r: any) => ({
    id: r.id,
    name: r.name,
    brand: r.brand ?? null,
    category: r.category ?? null,
    sellingPrice: Number(r.selling_price ?? r.sellingPrice ?? 0),
    comparePrice: r.compare_price ?? null,
    inStockCount: Number(r.in_stock_count ?? 0),
    soldCount: Number(r.sold_count ?? 0),
    returnedCount: Number(r.returned_count ?? 0),
    shortDescription: r.short_description ?? null,
    aiSummary: r.ai_summary ?? null,
    imageUrl: r.image_url ?? null,
    tags: r.tags ?? [],
    specifications: r.specifications ?? null,
  });

  const inStock = rows.filter((r: any) => Number(r.in_stock_count ?? 0) > 0);

  const lowStock = inStock
    .filter((r: any) => Number(r.in_stock_count ?? 0) <= LOW_STOCK_THRESHOLD)
    .map(toCard);

  const recentlyAdded = rows
    .filter((r: any) => r.created_at && new Date(r.created_at) >= cutoff)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map(toCard);

  const fastSelling = [...rows]
    .sort((a: any, b: any) => Number(b.sold_count ?? 0) - Number(a.sold_count ?? 0))
    .slice(0, FAST_SELL_TOP_N)
    .filter((r: any) => Number(r.sold_count ?? 0) > 0)
    .map(toCard);

  const totalInStock = rows.reduce((s: number, r: any) => s + Number(r.in_stock_count ?? 0), 0);
  const totalSold = rows.reduce((s: number, r: any) => s + Number(r.sold_count ?? 0), 0);

  return {
    categories,
    lowStock,
    recentlyAdded,
    fastSelling,
    stats: {
      totalProducts: rows.length,
      totalInStock,
      totalSold,
      totalLowStock: lowStock.length,
    },
  };
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      dashboardData: null,
      isSyncing: false,
      lastSyncedAt: null,

      /**
       * Full sync: calls the NestJS backend for the first load or
       * when Supabase credentials are unavailable.
       */
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
          // Fall back to a delta sync via Supabase if the NestJS call fails
          await get().deltaSync();
        } finally {
          set({ isSyncing: false });
        }
      },

      /**
       * Delta sync: directly queries Supabase for rows where `updated_at`
       * is greater than the last heartbeat timestamp.
       * Bypasses the Render NestJS processing layer entirely.
       * Merges changed rows into the current cached dashboard silently.
       */
      deltaSync: async () => {
        if (!supabase) return; // Supabase not configured — skip gracefully

        const { lastSyncedAt, dashboardData } = get();

        try {
          // Only fetch rows modified since the last sync tick
          let query = supabase
            .from('products')
            .select(
              'id, name, brand, category, selling_price, compare_price, ' +
              'in_stock_count, sold_count, returned_count, short_description, ' +
              'ai_summary, image_url, tags, specifications, created_at, updated_at'
            )
            .order('updated_at', { ascending: false });

          if (lastSyncedAt) {
            query = query.gt('updated_at', lastSyncedAt);
          }

          const { data: deltaRows, error } = await query;

          if (error) {
            console.error('[PosStore] Supabase delta sync error:', error.message);
            return;
          }

          if (!deltaRows || deltaRows.length === 0) {
            // Nothing changed — just bump the heartbeat timestamp
            set({ lastSyncedAt: new Date().toISOString() });
            return;
          }

          // Merge deltas: if we already have a full snapshot, patch it;
          // otherwise build a full snapshot from the new rows alone.
          if (dashboardData && lastSyncedAt) {
            // Rebuild from full snapshot — fetch all in this case since we don't
            // have a local full dataset to patch against. Trigger a full sync instead.
            const { data: allRows, error: allErr } = await supabase
              .from('products')
              .select(
                'id, name, brand, category, selling_price, compare_price, ' +
                'in_stock_count, sold_count, returned_count, short_description, ' +
                'ai_summary, image_url, tags, specifications, created_at, updated_at'
              );

            if (!allErr && allRows) {
              set({
                dashboardData: buildDashboardFromRows(allRows),
                lastSyncedAt: new Date().toISOString(),
              });
            }
          } else {
            // Cold start with Supabase: build dashboard locally from fetched rows
            const { data: allRows, error: allErr } = await supabase
              .from('products')
              .select(
                'id, name, brand, category, selling_price, compare_price, ' +
                'in_stock_count, sold_count, returned_count, short_description, ' +
                'ai_summary, image_url, tags, specifications, created_at, updated_at'
              );

            if (!allErr && allRows) {
              set({
                dashboardData: buildDashboardFromRows(allRows),
                lastSyncedAt: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          console.error('[PosStore] Supabase delta sync unexpected error:', err);
        }
      },
    }),
    {
      name: 'electrotrack-pos-cache',
      // Only persist the snapshot + heartbeat — not transient sync flags
      partialize: (state) => ({
        dashboardData: state.dashboardData,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
