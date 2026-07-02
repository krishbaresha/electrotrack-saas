import { useEffect, useRef, useState } from 'react';
import { TrendingUp, ShoppingCart, Package, Tag, Banknote, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../../store/dashboard.store';

import SalesChart from '../../components/dashboard/SalesChart';
import SalesFeed from '../../components/dashboard/SalesFeed';
import StockAlerts from '../../components/dashboard/StockAlerts';
import AiInsights from '../../components/dashboard/AiInsights';
import gsap from 'gsap';

const formatPKR = (n: number) => `₨ ${n.toLocaleString('en-PK')}`;

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const summary = useDashboardStore((s) => s.summary);
  const syncDashboard = useDashboardStore((s) => s.syncDashboard);
  const fetchAiInsight = useDashboardStore((s) => s.fetchAiInsight);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    syncDashboard();
    if (!useDashboardStore.getState().aiInsight) {
      fetchAiInsight();
    }
  }, [syncDashboard, fetchAiInsight]);

  useEffect(() => {
    if (containerRef.current) {
      const els = containerRef.current.querySelectorAll('.glass-card');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [summary]);

  const statCards = summary
    ? [
        { label: "Today's Revenue", value: formatPKR(summary.totalRevenue), icon: TrendingUp, color: 'text-stitch-tertiary', accent: 'bg-stitch-tertiary' },
        { label: 'Gross Profit', value: formatPKR(summary.totalGrossProfit || 0), icon: Banknote, color: 'text-green-500', accent: 'bg-green-500' },
        { label: 'Total Sales', value: String(summary.totalSales), icon: ShoppingCart, color: 'text-stitch-primary', accent: 'bg-stitch-primary' },
        { label: 'Items Sold', value: String(summary.totalItems), icon: Package, color: 'text-green-400', accent: 'bg-green-400' },
        { label: 'Discounts Given', value: formatPKR(summary.totalDiscounts), icon: Tag, color: 'text-amber-400', accent: 'bg-amber-400' },
      ]
    : [];

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-space text-white">Dashboard</h1>
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stitch-primary text-stitch-on-primary text-sm font-bold shadow hover:bg-stitch-primary/90 transition-all"
        >
          <FileText size={15} />
          View All Invoices
        </button>
      </div>

      <AiInsights />

      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const isItemsCard = card.label === 'Items Sold';
            return (
              <div
                key={card.label}
                onClick={isItemsCard ? () => setShowItemsModal(true) : undefined}
                className={`glass-card rounded-xl p-4 overflow-hidden relative ${isItemsCard ? 'cursor-pointer hover:bg-white/[0.04] transition-colors active:scale-[0.98]' : ''}`}
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${card.accent}/60`} />
                <div className={`w-8 h-8 rounded-lg ${card.accent}/10 flex items-center justify-center mb-3`}>
                  <card.icon size={16} className={card.color} />
                </div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">{card.label}</p>
                <p className={`text-xl font-bold font-space mt-1 ${card.color} tabular-nums`}>{card.value}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 h-24 animate-pulse bg-white/5" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-4">
          <SalesChart />
        </div>
        <div className="space-y-4">
          <StockAlerts />
          <SalesFeed />
        </div>
      </div>

      {showItemsModal && summary && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowItemsModal(false)}>
          <div className="w-full sm:max-w-md bg-stitch-surface-container rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-space">Items Sold Today</h3>
                <p className="text-xs text-white/50">{summary.totalItems} total items sold</p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {summary.soldProducts && summary.soldProducts.length > 0 ? (
                summary.soldProducts.map((p) => (
                  <div key={p.productId} className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-white truncate leading-tight">{p.name}</p>
                      <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                        <span className="text-xs font-bold font-space">{p.units}x</span>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">{formatPKR(p.revenue)} revenue</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <Package className="mx-auto h-8 w-8 text-white/20 mb-2" />
                  <p className="text-sm text-white/50">No items sold yet today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
