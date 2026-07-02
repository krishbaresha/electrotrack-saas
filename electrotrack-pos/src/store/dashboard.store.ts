import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format, subDays, parseISO } from 'date-fns';
import { api } from '../api/client';
import type { SalesSummary, LowStockItem, WsStockLowPayload } from '../types';

export interface InsightResponse {
  insight: string;
  generatedAt: string;
}

export interface DayData {
  date: string;
  revenue: number;
  sales: number;
}

interface DashboardState {
  summary: SalesSummary | null;
  chartData: DayData[];
  aiInsight: InsightResponse | null;
  lowStock: LowStockItem[];
  isSyncing: boolean;
  syncDashboard: () => Promise<void>;
  fetchAiInsight: () => Promise<void>;
  updateLowStockFromWs: (data: WsStockLowPayload) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      summary: null,
      chartData: [],
      aiInsight: null,
      lowStock: [],
      isSyncing: false,
      
      syncDashboard: async () => {
        set({ isSyncing: true });
        try {
          const today = format(new Date(), 'yyyy-MM-dd');
          
          // Fire API calls
          const summaryReq = api.get<SalesSummary>(`/reports/sales-summary?date=${today}`);
          const lowStockReq = api.get<{ threshold: number; products: LowStockItem[] }>('/reports/low-stock');
          
          const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));
          const chartReqs = days.map((d) => api.get<SalesSummary>(`/reports/sales-summary?date=${d}`));

          // Await first batch (we leave AI insight out of Promise.all to avoid blocking if Groq is slow)
          const [summaryRes, lowStockRes, ...chartResults] = await Promise.allSettled([
            summaryReq,
            lowStockReq,
            ...chartReqs,
          ]);

          // Process Summary
          if (summaryRes.status === 'fulfilled') {
            set({ summary: summaryRes.value.data });
          }

          // Process Low Stock
          if (lowStockRes.status === 'fulfilled') {
            set({ lowStock: lowStockRes.value.data.products.slice(0, 10) });
          }

          // Process Chart
          const cData: DayData[] = chartResults.map((r, i) => ({
            date: format(parseISO(days[i]), 'MMM d'),
            revenue: r.status === 'fulfilled' ? r.value.data.totalRevenue : 0,
            sales: r.status === 'fulfilled' ? r.value.data.totalSales : 0,
          }));
          set({ chartData: cData });

        } catch (error) {
          console.error("Dashboard sync error", error);
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchAiInsight: async () => {
        try {
          const res = await api.get<InsightResponse>('/ai/insights');
          set({ aiInsight: res.data });
        } catch (error) {
          console.error("Failed to fetch AI insights", error);
        }
      },

      updateLowStockFromWs: (data) => {
        set((state) => {
          const prev = state.lowStock;
          const exists = prev.find((a) => a.productId === data.productId);
          if (exists) {
            return {
              lowStock: prev.map((a) =>
                a.productId === data.productId ? { ...a, inStockCount: data.stockCount } : a,
              ),
            };
          }
          return {
            lowStock: [
              {
                productId: data.productId,
                productName: data.productName,
                brand: null,
                category: null,
                inStockCount: data.stockCount,
                sellingPrice: 0,
              },
              ...prev,
            ].slice(0, 10),
          };
        });
      },
    }),
    {
      name: 'electrotrack-dashboard-cache',
    }
  )
);
