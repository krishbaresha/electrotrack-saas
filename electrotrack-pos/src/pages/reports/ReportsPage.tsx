import { useRef, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { FileText, TrendingUp, Users, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { SalesSummary, StaffPerformance, DeadStockItem } from '../../types';
import { useCan } from '../../lib/permissions';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import gsap from 'gsap';

const formatPKR = (n: number) => `₨ ${n.toLocaleString('en-PK')}`;

type Tab = 'sales' | 'staff' | 'deadstock';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [staff, setStaff] = useState<StaffPerformance[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockItem[]>([]);
  const [error, setError] = useState('');
  const isOnlineEnabled = useCan('pos.online_sell');
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isStarter } = useFeatureGate();

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
  }, []);

  const loadSales = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<SalesSummary>(`/reports/sales-summary/range?from=${from}&to=${to}`);
      setSummary(data);
    } catch {
      setError('Failed to load sales report');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<StaffPerformance[]>(`/reports/staff-performance?from=${from}&to=${to}`);
      setStaff(data);
    } catch {
      setError('Failed to load staff report');
    } finally {
      setLoading(false);
    }
  };

  const loadDeadStock = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<DeadStockItem[]>('/reports/dead-stock?days=60');
      setDeadStock(data);
    } catch {
      setError('Failed to load dead stock report');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors';

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'sales', label: 'Sales Summary', icon: TrendingUp },
    { key: 'staff', label: 'Staff Performance', icon: Users },
    { key: 'deadstock', label: 'Dead Stock', icon: Package },
  ];

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto relative min-h-[85vh]">
      {isStarter && (
        <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-30 animate-in fade-in duration-300 rounded-2xl">
          <div className="glass-card max-w-md p-8 border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center bg-zinc-900/80">
            <div className="w-16 h-16 rounded-full bg-stitch-primary/10 flex items-center justify-center mb-6">
              <TrendingUp size={32} className="text-stitch-primary animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-white font-space">Unlock Advanced Telemetry Analytics</h2>
            <p className="text-xs text-white/60 mt-3 leading-relaxed">
              Get real-time performance insights, dead stock analysis, sales forecasting, and custom cashier performance analytics. Upgrade to ElectroTrack Pro Core to unlock.
            </p>
            <button
              type="button"
              onClick={() => navigate('/checkout?plan=pro')}
              className="mt-6 w-full py-2.5 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 transition-all active:scale-[0.98] font-space"
            >
              Upgrade to Pro Core
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-stitch-primary/10 flex items-center justify-center">
          <FileText size={20} className="text-stitch-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stitch-on-surface font-space">Reports</h1>
          <p className="text-xs text-stitch-on-surface-variant">Sales analytics, staff performance and dead stock</p>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-2 border-l-4 border-stitch-error/50">
          <AlertTriangle size={14} className="text-stitch-error shrink-0" />
          <p className="text-sm text-stitch-error">{error}</p>
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex border-b border-white/5 px-4 gap-1 bg-white/[0.01]">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setError(''); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                tab === t.key
                  ? 'border-stitch-primary text-stitch-primary'
                  : 'border-transparent text-stitch-on-surface-variant hover:text-white'
              }`}>
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {(tab === 'sales' || tab === 'staff') && (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1">From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </div>
              <button
                onClick={tab === 'sales' ? loadSales : loadStaff}
                disabled={loading}
                className="px-4 py-2 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 disabled:opacity-50 transition-all active:scale-95">
                {loading ? 'Loading…' : 'Run Report'}
              </button>
            </div>
          )}

          {tab === 'sales' && !summary && !loading && (
            <div className="py-12 text-center">
              <TrendingUp size={32} className="mx-auto mb-2 text-stitch-on-surface-variant/30" />
              <p className="text-sm text-stitch-on-surface-variant">Select a date range and run the report</p>
            </div>
          )}

          {tab === 'sales' && summary && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total Revenue', value: formatPKR(summary.totalRevenue), color: 'text-stitch-tertiary' },
                  { label: 'Gross Profit', value: formatPKR(summary.totalGrossProfit || 0), color: 'text-green-500' },
                  { label: 'Total Sales', value: String(summary.totalSales), color: 'text-stitch-primary' },
                  { label: 'Items Sold', value: String(summary.totalItems), color: 'text-green-400' },
                  { label: 'Discounts Given', value: formatPKR(summary.totalDiscounts), color: 'text-amber-400' },
                ].map((c) => (
                  <div key={c.label} className="glass-card rounded-xl p-4">
                    <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">{c.label}</p>
                    <p className={`text-xl font-bold font-space mt-1 tabular-nums ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {isOnlineEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-card rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                    <h3 className="text-xs font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-2">Offline vs Online Revenue</h3>
                    <div className="space-y-3 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stitch-on-surface-variant">Offline Sales</span>
                        <span className="font-bold text-white tabular-nums">{formatPKR(summary.offlineRevenue)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stitch-on-surface-variant">Online Sales (Advances)</span>
                        <span className="font-bold text-emerald-400 tabular-nums">{formatPKR(summary.onlineRevenue - summary.courierPayouts)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                        <span className="text-stitch-on-surface-variant">Bulk Courier Payouts</span>
                        <span className="font-bold text-indigo-400 tabular-nums">{formatPKR(summary.courierPayouts)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-5 border border-white/5 bg-white/[0.01]">
                    <h3 className="text-xs font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-2">Sales Volume</h3>
                    <div className="space-y-3 mt-4 flex flex-col justify-center h-full pb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stitch-on-surface-variant">Offline Orders</span>
                        <span className="font-bold text-white tabular-nums">{summary.offlineSalesCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stitch-on-surface-variant">Online Orders</span>
                        <span className="font-bold text-emerald-400 tabular-nums">{summary.onlineSalesCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-5 border border-indigo-500/20 bg-indigo-500/5 flex flex-col items-center justify-center">
                    <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">New Pending Online</p>
                    <p className="text-3xl font-bold text-white tabular-nums">{summary.pendingOnlineOrders}</p>
                    <p className="text-[10px] text-stitch-on-surface-variant mt-2 text-center">Orders created in this period</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-stitch-on-surface font-space mb-4">By Payment Method</h3>
                  <div className="space-y-2">
                    {summary.byPaymentMethod.map((pm) => (
                      <div key={pm.method} className="flex justify-between text-sm">
                        <span className="text-stitch-on-surface-variant capitalize">{pm.method.replace('_', ' ')}</span>
                        <div className="text-right">
                          <span className="font-semibold text-stitch-on-surface">{pm.count} sales</span>
                          <span className="text-stitch-on-surface-variant ml-2 font-mono">{formatPKR(pm.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-stitch-on-surface font-space mb-4">Top Products</h3>
                  <div className="space-y-2">
                    {summary.soldProducts.slice(0, 5).map((p: { productId: string; name: string; units: number; revenue: number }, i: number) => (
                      <div key={p.productId} className="flex items-center gap-3 text-sm">
                        <span className="text-stitch-on-surface-variant text-xs w-4 text-right font-mono">{i + 1}.</span>
                        <span className="flex-1 text-stitch-on-surface truncate">{p.name}</span>
                        <span className="text-stitch-on-surface-variant text-xs">{p.units}u</span>
                        <span className="font-bold tabular-nums font-mono text-stitch-on-surface">{formatPKR(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'staff' && (
            <div className="overflow-x-auto">
              {staff.length === 0 ? (
                <div className="py-12 text-center">
                  <Users size={32} className="mx-auto mb-2 text-stitch-on-surface-variant/30" />
                  <p className="text-sm text-stitch-on-surface-variant">Select a date range and run the report</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                      {['Staff Member', 'Sales', 'Revenue', 'Avg. Transaction'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {staff.map((s) => (
                      <tr key={s.staffId} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-stitch-on-surface text-sm">{s.staffName}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-stitch-on-surface-variant">{s.totalSales}</td>
                        <td className="px-4 py-3 text-sm tabular-nums font-bold text-stitch-tertiary font-mono">{formatPKR(s.totalRevenue)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-stitch-on-surface-variant font-mono">
                          {formatPKR(Math.round(s.avgTransactionValue))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'deadstock' && (
            <div className="space-y-4">
              <button onClick={loadDeadStock} disabled={loading}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm font-bold rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-all active:scale-95">
                {loading ? 'Loading…' : 'Load Dead Stock (60+ days unsold)'}
              </button>
              {deadStock.length === 0 && !loading && (
                <div className="py-12 text-center">
                  <Package size={32} className="mx-auto mb-2 text-stitch-on-surface-variant/30" />
                  <p className="text-sm text-stitch-on-surface-variant">No dead stock found — run analysis above</p>
                </div>
              )}
              {deadStock.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                        {['Serial', 'Product', 'Brand', 'Days in Stock', 'Received'].map((h) => (
                          <th key={h} className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {deadStock.map((u) => (
                        <tr key={u.unitId} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-stitch-tertiary">{u.serialNumber}</td>
                          <td className="px-4 py-3 text-sm font-medium text-stitch-on-surface">{u.productName}</td>
                          <td className="px-4 py-3 text-sm text-stitch-on-surface-variant">{u.brand ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold font-mono ${u.daysInStock > 90 ? 'text-stitch-error' : 'text-amber-400'}`}>
                              {u.daysInStock}d
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-stitch-on-surface-variant font-mono">
                            {format(new Date(u.receivedAt), 'dd MMM yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
