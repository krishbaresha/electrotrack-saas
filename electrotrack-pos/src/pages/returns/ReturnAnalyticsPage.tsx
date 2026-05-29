import { useEffect, useRef, useState } from 'react';
import { TrendingDown, AlertTriangle, Package, BarChart2 } from 'lucide-react';
import { api } from '../../api/client';
import gsap from 'gsap';

const formatPKR = (n: number) => `₨ ${n.toLocaleString('en-PK')}`;

interface ReturnAnalytics {
  totalReturns: number;
  totalRefundValue: number;
  mostReturnedProducts: { productId: string; productName: string; returnCount: number }[];
  returnReasons: { reason: string; count: number }[];
  suspiciousReturnCustomers: { customerId: string; customerName: string; phone: string; returnCount: number }[];
}

export default function ReturnAnalyticsPage() {
  const [data, setData] = useState<ReturnAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await api.get<ReturnAnalytics>(`/reports/return-analytics?${params}`);
      setData(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError('Access denied — you need the returns.read permission.');
      } else if (status === 401) {
        setError('Session expired — please log in again.');
      } else {
        setError('Failed to load return analytics. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  useEffect(() => {
    if (data && containerRef.current) {
      const els = containerRef.current.querySelectorAll('.glass-card');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [data]);

  const suspiciousCount = data ? data.suspiciousReturnCustomers.length : 0;
  const maxReason = data ? Math.max(...data.returnReasons.map((r) => r.count), 1) : 1;

  return (
    <div ref={containerRef} className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stitch-error-container flex items-center justify-center">
            <TrendingDown size={20} className="text-stitch-error" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stitch-on-surface font-space">Return Analytics</h1>
            <p className="text-xs text-stitch-on-surface-variant">Loss analysis, fraud patterns, product return breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50" />
          <span className="text-stitch-on-surface-variant text-sm">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50" />
          <button onClick={() => void loadData()}
            className="bg-stitch-primary text-stitch-on-primary font-bold px-4 py-1.5 rounded-lg text-sm transition-all active:scale-95">
            Filter
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="glass-card rounded-xl p-5 flex items-center gap-3 border-l-4 border-stitch-error/50">
          <AlertTriangle size={18} className="text-stitch-error shrink-0" />
          <p className="text-sm text-stitch-error">{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Returns', value: data.totalReturns.toString(), icon: TrendingDown, color: 'text-stitch-error', bg: 'bg-stitch-error/10' },
              { label: 'Total Refund Value', value: formatPKR(data.totalRefundValue), icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Suspicious Returns', value: suspiciousCount.toString(), icon: AlertTriangle, color: 'text-stitch-error', bg: 'bg-stitch-error/10' },
              { label: 'Unique Products', value: data.mostReturnedProducts.length.toString(), icon: Package, color: 'text-stitch-primary', bg: 'bg-stitch-primary/10' },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-card rounded-xl p-4">
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
                  <kpi.icon size={16} className={kpi.color} />
                </div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">{kpi.label}</p>
                <p className={`text-xl font-bold font-space mt-1 ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-base font-semibold text-stitch-on-surface font-space mb-4">Returns by Reason</h2>
              {data.returnReasons.length === 0 ? (
                <p className="text-sm text-stitch-on-surface-variant text-center py-8">No return data</p>
              ) : (
                <div className="space-y-3">
                  {data.returnReasons.map((r) => (
                    <div key={r.reason}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-stitch-on-surface capitalize">{r.reason.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-mono text-stitch-on-surface-variant">{r.count}</span>
                      </div>
                      <div className="h-2 bg-stitch-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-stitch-error to-stitch-error/60 rounded-full"
                          style={{ width: `${(r.count / maxReason) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-xl p-5">
              <h2 className="text-base font-semibold text-stitch-on-surface font-space mb-4">Most Returned Products</h2>
              {data.mostReturnedProducts.length === 0 ? (
                <p className="text-sm text-stitch-on-surface-variant text-center py-8">No return data</p>
              ) : (
                <div className="space-y-2">
                  {data.mostReturnedProducts.slice(0, 8).map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-[10px] font-bold text-stitch-on-surface-variant w-5 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stitch-on-surface truncate">{p.productName}</p>
                      </div>
                      <span className="text-sm font-bold font-mono text-stitch-error shrink-0">{p.returnCount}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {data.suspiciousReturnCustomers.length > 0 && (
            <div className="glass-card rounded-xl p-5"
              style={{ border: '1px solid rgba(255,180,171,0.3)', boxShadow: '0 0 20px rgba(147,0,10,0.15)' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-stitch-error" />
                <h2 className="text-base font-semibold text-stitch-error font-space">Fraud Patterns — High-Risk Customers</h2>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                    {['Customer', 'Phone', 'Suspicious Returns'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.suspiciousReturnCustomers.map((c) => (
                    <tr key={c.customerId} className="hover:bg-stitch-error/5 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-stitch-on-surface">{c.customerName}</td>
                      <td className="px-4 py-3 text-sm font-mono text-stitch-on-surface-variant">{c.phone}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-stitch-error bg-stitch-error/10 px-2 py-0.5 rounded-full">
                          {c.returnCount} returns
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
