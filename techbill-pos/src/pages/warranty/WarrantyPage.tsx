import { useEffect, useRef, useState } from 'react';
import { Search, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { addDays, format, differenceInDays } from 'date-fns';
import { api } from '../../api/client';
import gsap from 'gsap';

interface WarrantyResult {
  serialNumber: string;
  status: 'in_stock' | 'sold' | 'returned';
  soldAt: string | null;
  sale: {
    createdAt: string;
  };
  product: {
    name: string;
    brand: string | null;
    category: string;
    warrantyMonths: number;
  };
}

interface CheckedItem {
  serial: string;
  productName: string;
  status: 'active' | 'expired' | 'not_sold';
  daysLeft: number;
  checkedAt: Date;
}

function getWarrantyInfo(r: WarrantyResult) {
  if (!r.soldAt || r.status === 'in_stock') return null;
  const soldDate = new Date(r.sale.createdAt);
  const expiryDate = addDays(soldDate, r.product.warrantyMonths);
  const daysLeft = differenceInDays(expiryDate, new Date());
  const totalDays = r.product.warrantyMonths;
  const daysUsed = differenceInDays(new Date(), soldDate);
  const pct = Math.min(100, Math.round((daysUsed / totalDays) * 100));
  return { soldDate, expiryDate, daysLeft, pct, expired: daysLeft < 0 };
}

export default function WarrantyPage() {
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentChecks, setRecentChecks] = useState<CheckedItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const els = containerRef.current.querySelectorAll('.stagger-item');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get<WarrantyResult>(`/inventory/units/lookup/${serial.trim()}?anyStatus=true`);
      setResult(res.data);
      const info = getWarrantyInfo(res.data);
      setRecentChecks((prev) => [
        {
          serial: res.data.serialNumber,
          productName: res.data.product.name,
          status: !res.data.soldAt ? 'not_sold' : info!.expired ? 'expired' : 'active',
          daysLeft: info?.daysLeft ?? 0,
          checkedAt: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
      if (resultRef.current) {
        gsap.killTweensOf(resultRef.current);
        gsap.fromTo(resultRef.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.25, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
        );
      }
    } catch {
      setError('Serial number not found. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const info = result ? getWarrantyInfo(result) : null;

  return (
    <div ref={containerRef} className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="stagger-item flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-stitch-secondary-container flex items-center justify-center">
          <Shield size={20} className="text-stitch-on-secondary-container" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stitch-on-surface font-space">Warranty Checker</h1>
          <p className="text-xs text-stitch-on-surface-variant">Verify warranty status by serial number</p>
        </div>
      </div>

      {/* Search */}
      <div className="stagger-item flex justify-center py-4">
        <form
          onSubmit={handleCheck}
          className="glass-card w-full max-w-3xl rounded-xl p-6 space-y-4"
          style={{ boxShadow: '0 0 20px rgba(128,131,255,0.15)', border: '1px solid rgba(128,131,255,0.3)' }}
        >
          <div className="flex items-center gap-2">
            <Search size={18} className="text-stitch-primary" />
            <h3 className="text-base font-semibold text-stitch-on-surface font-space">Enter Serial Number</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. SN-HP14-00423 or scan barcode"
              className="flex-1 bg-stitch-surface-container-lowest/50 border-b-2 border-stitch-primary/30 focus:border-stitch-primary text-lg font-mono py-3 px-4 rounded-t-lg outline-none text-stitch-on-surface placeholder:text-stitch-on-surface-variant/40 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-stitch-primary hover:bg-stitch-primary-container text-stitch-on-primary font-bold px-8 py-3 rounded-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-stitch-on-primary/30 border-t-stitch-on-primary rounded-full animate-spin" />
              ) : (
                <Search size={16} />
              )}
              Check Warranty
            </button>
          </div>
          {error && (
            <p className="text-stitch-error text-sm flex items-center gap-2">
              <ShieldX size={14} /> {error}
            </p>
          )}
        </form>
      </div>

      {/* Result - has warranty info */}
      {result && info && (
        <div ref={resultRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-5 overflow-hidden relative">
            <div className={`absolute -right-10 -top-10 w-28 h-28 rounded-full blur-3xl ${info.expired ? 'bg-stitch-error/10' : 'bg-green-500/10'}`} />
            <div className="flex justify-between items-start mb-4">
              <div className={`px-3 py-1 rounded-full text-[11px] font-bold ${info.expired ? 'bg-stitch-error/10 text-stitch-error border-l-2 border-stitch-error' : 'bg-green-500/10 text-green-400 border-l-2 border-green-400'}`}>
                {info.expired ? '❌ WARRANTY EXPIRED' : '✅ IN WARRANTY'}
              </div>
              <p className="font-mono text-xs text-stitch-on-surface-variant">
                SN: <span className={info.expired ? 'text-stitch-error' : 'text-stitch-primary'}>{result.serialNumber}</span>
              </p>
            </div>
            <div className="mb-4">
              <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Status</p>
              <p className="text-3xl font-bold text-stitch-on-surface font-space">
                {info.expired ? `Expired ${Math.abs(info.daysLeft)} days` : `${info.daysLeft} days`}{' '}
                <span className="text-base font-normal opacity-60">{info.expired ? 'ago' : 'remaining'}</span>
              </p>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">
                <span>Usage Timeline</span>
                <span>{info.pct}% {info.expired ? 'Expired' : 'Used'}</span>
              </div>
              <div className="h-2 bg-stitch-surface-container-highest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${info.expired ? 'bg-stitch-error/50' : 'bg-gradient-to-r from-green-500 to-green-300'}`}
                  style={{ width: `${info.pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Purchase Date</p>
                <p className="text-sm font-medium mt-0.5">{format(info.soldDate, 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Warranty Period</p>
                <p className="text-sm font-medium mt-0.5">{result.product.warrantyMonths} Days</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Expiry Date</p>
                <p className={`text-sm font-medium mt-0.5 ${info.expired ? 'text-stitch-error' : ''}`}>
                  {format(info.expiryDate, 'dd MMM yyyy')}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Unit Status</p>
                <p className="text-sm font-medium mt-0.5 capitalize">{result.status.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-stitch-tertiary" />
              <h3 className="font-semibold text-stitch-on-surface font-space">Product Details</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Product Name</p>
                <p className="text-lg font-semibold text-stitch-on-surface mt-1 font-space">{result.product.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Brand</p>
                  <p className="text-sm font-medium mt-0.5">{result.product.brand ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Category</p>
                  <p className="text-sm font-medium mt-0.5">{result.product.category}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-stitch-surface-container-high/50 border border-white/5">
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1">Serial Number</p>
                <p className="font-mono text-stitch-tertiary text-sm">{result.serialNumber}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-stock (no sale date) */}
      {result && result.status === 'in_stock' && (
        <div ref={resultRef} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stitch-on-surface-variant/70">Duration</p>
            <p className="text-sm font-medium mt-0.5">{result.product.warrantyMonths} Days</p>
          </div>
        </div>
      )}

      {/* Recent Checks */}
      {recentChecks.length > 0 && (
        <div className="stagger-item">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base font-semibold text-stitch-on-surface font-space">Recent Checks</h3>
            <span className="text-xs text-stitch-on-surface-variant">This session</span>
          </div>
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                  {['Serial', 'Product', 'Status', 'Days Left', 'Checked'].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentChecks.map((c, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 font-mono text-sm text-stitch-primary">{c.serial}</td>
                    <td className="px-5 py-3 text-sm text-stitch-on-surface">{c.productName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${c.status === 'active' ? 'text-green-400' : c.status === 'expired' ? 'text-stitch-error' : 'text-amber-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-green-400' : c.status === 'expired' ? 'bg-stitch-error' : 'bg-amber-400'}`} />
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className={`px-5 py-3 font-mono text-sm ${c.daysLeft < 0 ? 'text-stitch-error' : 'text-stitch-on-surface'}`}>{c.daysLeft}</td>
                    <td className="px-5 py-3 text-sm text-stitch-on-surface-variant">{format(c.checkedAt, 'h:mm a')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
