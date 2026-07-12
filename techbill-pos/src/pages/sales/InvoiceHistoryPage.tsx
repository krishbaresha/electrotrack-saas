import React, { useEffect, useRef, useState } from 'react';
import { FileText, Search, ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { api } from '../../api/client';
import gsap from 'gsap';
import InvoiceModal from '../../components/pos/InvoiceModal';
import type { Sale, ShopSettings } from '../../types';
import { useToastStore } from '../../store/toast.store';
import { TableSkeleton } from '../../components/common/Skeleton';

const formatPKR = (n: number) => `₨ ${n.toLocaleString('en-PK')}`;

interface SaleListItem {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  discountAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string } | null;
  soldBy: { id: string; name: string } | null;
  _count: { items: number };
  isOnline: boolean;
  codAmount?: number;
  returns?: { id: string }[];
  shippingStatus?: string;
}

interface SaleDetail {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  discountAmount: number;
  paymentMethod: string;
  status: string;
  shippingStatus?: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string } | null;
  soldBy: { id: string; name: string } | null;
  items: {
    id: string;
    sellingPrice: number;
    inventoryUnit: {
      id: string;
      serialNumber: string;
      product: { name: string; brand: string | null; warrantyMonths: number };
    };
  }[];
  returns?: { inventoryUnitId: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  voided:    'bg-stitch-error/10 text-stitch-error border-stitch-error/20',
  pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', easypaisa: 'Easypaisa', jazzcash: 'JazzCash',
  card: 'Card', bank_transfer: 'Bank Transfer',
};

function ExpandedDetail({ saleId, createdAt, onViewReceipt }: { saleId: string; createdAt: string; onViewReceipt: (detail: SaleDetail) => void }) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SaleDetail>(`/sales/${saleId}`)
      .then((r) => setDetail(r.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [saleId]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <span className="w-5 h-5 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!detail) {
    return <p className="text-xs text-stitch-on-surface-variant py-3 px-4">Failed to load details.</p>;
  }

  const saleDate = new Date(createdAt);

  return (
    <div className="px-4 pb-4 pt-2 overflow-x-auto">
      <table className="w-full text-left text-xs min-w-[600px]">
        <thead>
          <tr className="border-b border-white/5">
            {['Product', 'Brand', 'Serial Number', 'Warranty Start', 'Warranty End', 'Status', 'Unit Price'].map((h) => (
              <th key={h} className="pb-1.5 pr-4 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
            <th className="pb-1.5 text-right">
              <button
                onClick={() => onViewReceipt(detail)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-stitch-primary/10 text-stitch-primary hover:bg-stitch-primary/20 rounded transition-colors"
              >
                <FileText size={12} />
                View Receipt
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {detail.items.map((item) => {
            const wDays = item.inventoryUnit.product.warrantyMonths;
            const warrantyEnd = wDays > 0 ? addDays(saleDate, wDays) : null;
            const isActive = warrantyEnd ? warrantyEnd > new Date() : false;
            
            const returnedUnitIds = new Set(detail.returns?.map(r => r.inventoryUnitId) || []);
            const isSaleVoided = detail.status === 'voided' || detail.shippingStatus === 'returned';
            const isItemReturned = isSaleVoided || returnedUnitIds.has(item.inventoryUnit.id);

            return (
              <tr key={item.id} className="hover:bg-white/[0.02]">
                <td className="py-2 pr-4 font-medium text-stitch-on-surface">{item.inventoryUnit.product.name}</td>
                <td className="py-2 pr-4 text-stitch-on-surface-variant">{item.inventoryUnit.product.brand ?? '—'}</td>
                <td className="py-2 pr-4 font-mono text-stitch-tertiary">{item.inventoryUnit.serialNumber}</td>
                <td className="py-2 pr-4 text-stitch-on-surface-variant whitespace-nowrap">
                  {wDays > 0 ? format(saleDate, 'dd MMM yyyy') : '—'}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {warrantyEnd ? format(warrantyEnd, 'dd MMM yyyy') : '—'}
                </td>
                <td className="py-2 pr-4">
                  {isItemReturned ? (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Returned
                    </span>
                  ) : warrantyEnd ? (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      isActive
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-stitch-error/10 text-stitch-error border-stitch-error/20'
                    }`}>
                      {isActive ? `Active (${wDays}d)` : 'Expired'}
                    </span>
                  ) : (
                    <span className="text-stitch-on-surface-variant/50">None</span>
                  )}
                </td>
                <td className="py-2 pr-4 font-mono tabular-nums text-stitch-on-surface">
                  {formatPKR(Number(item.sellingPrice))}
                </td>
                <td className="py-2"></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function InvoiceHistoryPage() {
  const toast = useToastStore();
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [viewSale, setViewSale] = useState<SaleDetail | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const limit = 25;

  const load = (p: number, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (q) params.set('search', q);
    api.get<{ data: SaleListItem[]; meta: { total: number } }>(`/sales?${params.toString()}`)
      .then((r) => {
        setSales(r.data.data ?? []);
        setTotal(r.data.meta?.total ?? 0);
      })
      .catch(() => {
        setSales([]);
        toast.error('Failed to load invoice history.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page, search); }, [page, search]);

  useEffect(() => {
    api.get<ShopSettings>('/settings')
      .then((r) => setShopSettings(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && containerRef.current) {
      const els = containerRef.current.querySelectorAll('.inv-row');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 4 },
        { opacity: 1, y: 0, duration: 0.2, stagger: 0.02, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [loading, sales]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stitch-primary/10 flex items-center justify-center shrink-0">
            <FileText size={20} className="text-stitch-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stitch-on-surface font-space">Invoice History</h1>
            <p className="text-xs text-stitch-on-surface-variant">
              Complete sales ledger with serial &amp; warranty records · {total.toLocaleString()} total
            </p>
          </div>
        </div>
        <button
          onClick={() => load(page, search)}
          className="flex items-center gap-1.5 text-sm text-stitch-on-surface-variant hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Invoice number or customer name…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/40"
          />
        </div>
        <button type="submit"
          className="px-4 py-2 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 transition-all active:scale-95">
          Search
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="px-3 py-2 text-stitch-on-surface-variant hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} />
          </button>
        )}
      </form>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                {['Invoice #', 'Date & Time', 'Customer', 'Cashier', 'Items', 'Payment', 'Total', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && sales.length === 0 ? (
                <TableSkeleton cols={9} rows={8} />
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <FileText size={32} className="mx-auto mb-2 text-stitch-on-surface-variant/30" />
                    <p className="text-sm text-stitch-on-surface-variant">No invoices found</p>
                  </td>
                </tr>
              ) : sales.map((s) => (
                <React.Fragment key={s.id}>
                  <tr
                    key={s.id}
                    className="inv-row hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-stitch-primary font-bold whitespace-nowrap">
                      {s.invoiceNumber}
                      {s.isOnline && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-sans">Online</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-stitch-on-surface-variant whitespace-nowrap">
                      {format(new Date(s.createdAt), 'dd MMM yyyy')}<br />
                      <span className="text-stitch-on-surface-variant/60">{format(new Date(s.createdAt), 'h:mm a')}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.customer ? (
                        <>
                          <p className="text-sm text-stitch-on-surface">{s.customer.name}</p>
                          <p className="text-[10px] font-mono text-stitch-on-surface-variant">{s.customer.phone}</p>
                        </>
                      ) : (
                        <span className="text-sm text-stitch-on-surface-variant/50">Walk-in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-stitch-on-surface-variant">
                      {s.soldBy?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-center text-stitch-on-surface">
                      {s._count.items}
                    </td>
                    <td className="px-4 py-3 text-sm text-stitch-on-surface-variant whitespace-nowrap">
                      {PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}
                    </td>
                    <td className="px-4 py-3">
                      {s.isOnline ? (
                        <>
                          <p className="text-sm font-bold font-mono tabular-nums text-stitch-on-surface whitespace-nowrap">
                            {formatPKR(Number(s.codAmount ?? 0))}
                          </p>
                          <p className="text-[10px] font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                            COD Value
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold font-mono tabular-nums text-stitch-on-surface whitespace-nowrap">
                            {formatPKR(Number(s.totalAmount))}
                          </p>
                          {Number(s.discountAmount) > 0 && (
                            <p className="text-[10px] font-mono tabular-nums text-stitch-error whitespace-nowrap">
                              −{formatPKR(Number(s.discountAmount))} disc.
                            </p>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const isSaleVoided = s.status === 'voided' || s.shippingStatus === 'returned';
                        const hasReturns = (s.returns && s.returns.length > 0) || s.status === 'partial_return';
                        const displayStatus = isSaleVoided ? 'voided' : (hasReturns ? 'partial_return' : s.status);
                        return (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize whitespace-nowrap ${STATUS_STYLE[displayStatus] ?? 'bg-white/5 text-stitch-on-surface-variant border-white/10'}`}>
                            {displayStatus === 'partial_return' ? 'Partial Return' : displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-stitch-on-surface-variant">
                      {expandedId === s.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr className="bg-white/[0.015]">
                      <td colSpan={9}>
                        <ExpandedDetail saleId={s.id} createdAt={s.createdAt} onViewReceipt={setViewSale} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-xs text-stitch-on-surface-variant">
              Page {page} of {totalPages} · {total.toLocaleString()} records
            </p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs font-bold text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-40 transition-colors">
                Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs font-bold text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-40 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {viewSale && (
        <InvoiceModal
          sale={viewSale as unknown as Sale}
          shopSettings={shopSettings}
          onClose={() => setViewSale(null)}
        />
      )}
    </div>
  );
}
