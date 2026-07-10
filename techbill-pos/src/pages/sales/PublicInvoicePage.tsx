import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ShieldCheck, ShieldX, Clock, Package, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface PublicItem {
  id: string;
  sellingPrice: number;
  serialNumber: string;
  productName: string;
  productBrand: string | null;
  warrantyMonths: number;
  warrantyExpiresAt: string | null;
  warrantyDaysLeft: number | null;
}

interface PublicInvoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  shippingStatus?: string;
  customerName: string | null;
  customerPhone: string | null;
  cashierName: string | null;
  shopName: string;
  items: PublicItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

const formatPKR = (n: number) => `â‚¨ ${Number(n).toLocaleString('en-PK')}`;

function WarrantyBadge({ item, isReturned }: { item: PublicItem; isReturned: boolean }) {
  if (isReturned) return null;
  if (!item.warrantyMonths || item.warrantyMonths <= 0) {
    return <span className="text-xs text-white/30 italic">No warranty</span>;
  }
  const days = item.warrantyDaysLeft ?? 0;
  const expired = days < 0;
  const expiresAt = item.warrantyExpiresAt ? format(new Date(item.warrantyExpiresAt), 'dd MMM yyyy') : '';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
      expired
        ? 'bg-red-500/10 border-red-500/20 text-red-400'
        : days <= 30
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
    }`}>
      {expired
        ? <ShieldX size={15} className="shrink-0" />
        : days <= 30
        ? <Clock size={15} className="shrink-0" />
        : <ShieldCheck size={15} className="shrink-0" />
      }
      <div>
        {expired ? (
          <span className="font-semibold">Expired {Math.abs(days)} days ago</span>
        ) : (
          <span className="font-semibold">{days} days left</span>
        )}
        {expiresAt && (
          <span className="text-xs opacity-70 ml-2">until {expiresAt}</span>
        )}
      </div>
    </div>
  );
}

export default function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { setError('Invalid invoice link.'); setLoading(false); return; }
    fetch(`${API_BASE}/public/sales/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: PublicInvoice) => setInvoice(data))
      .catch(() => setError('Invoice not found or the link is invalid.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <ShieldX size={28} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Invoice Not Found</h1>
        <p className="text-sm text-white/50 max-w-xs">{error || 'This invoice link is invalid or does not exist.'}</p>
      </div>
    );
  }

  const saleDate = new Date(invoice.createdAt);
  const hasDiscount = invoice.discountAmount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-slate-950 flex flex-col items-center py-10 px-4">
      {/* Card */}
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-400 font-semibold font-mono">TechBill Ã‚• Verified Invoice</p>
            <h1 className="text-2xl font-bold text-white mt-1">{invoice.shopName}</h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
            <CheckCircle size={13} />
            VERIFIED
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
          
          {/* Watermark */}
          {(invoice.status === 'returned' || invoice.status === 'void' || invoice.shippingStatus === 'returned') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
              <span
                className="text-6xl font-black uppercase whitespace-nowrap opacity-[0.15] text-red-500"
                style={{ transform: 'rotate(-30deg)' }}
              >
                {invoice.status === 'void' ? 'VOID' : 'RETURNED'}
              </span>
            </div>
          )}

          {/* Invoice meta */}
          <div className="px-6 pt-6 pb-4 border-b border-white/5 relative z-10">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Tax Invoice</p>
            <p className="font-mono font-bold text-white text-lg">{invoice.invoiceNumber}</p>
            <p className="text-xs text-white/50 mt-1 tabular-nums">{format(saleDate, 'dd MMM yyyy, h:mm a')}</p>
          </div>

          {/* Customer */}
          {(invoice.customerName || invoice.cashierName) && (
            <div className="px-6 py-4 border-b border-white/5 relative z-10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Sold To</p>
              {invoice.customerName && (
                <p className="text-sm font-medium text-white">{invoice.customerName}</p>
              )}
              {invoice.customerPhone && (
                <p className="text-xs font-mono text-white/50 mt-0.5">{invoice.customerPhone}</p>
              )}
              {invoice.cashierName && (
                <p className="text-xs text-white/40 mt-1">Cashier Ã‚• {invoice.cashierName}</p>
              )}
            </div>
          )}

          {/* Items with warranty */}
          <div className="px-6 py-4 border-b border-white/5 relative z-10">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Items & Warranty</p>
            <div className="space-y-5">
              {invoice.items.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{item.productName}</p>
                      {item.productBrand && (
                        <p className="text-[11px] text-white/40">{item.productBrand}</p>
                      )}
                      <p className="text-[11px] font-mono text-teal-400/80 mt-0.5">SN Ã‚• {item.serialNumber}</p>
                    </div>
                    <p className="text-sm font-bold text-white tabular-nums whitespace-nowrap">{formatPKR(item.sellingPrice)}</p>
                  </div>
                  {/* Warranty status */}
                  <WarrantyBadge item={item} isReturned={invoice.status === 'returned' || invoice.status === 'void' || invoice.shippingStatus === 'returned'} />
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 space-y-2 relative z-10">
            <div className="flex justify-between text-sm text-white/60">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPKR(invoice.subtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-sm text-rose-400">
                <span>Discount</span>
                <span className="tabular-nums">âˆ’ {formatPKR(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="h-px bg-white/10 my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase tracking-widest text-white/50">Total</span>
              <span className="text-2xl font-bold text-white tabular-nums">{formatPKR(invoice.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-white/40">Payment</span>
              <span className="px-2.5 py-0.5 rounded-full border border-white/15 text-[10px] font-bold uppercase tracking-wider text-white/70">
                {PAYMENT_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-1">
          <div className="flex items-center justify-center gap-2 text-white/30">
            <Package size={14} />
            <p className="text-xs">Thank you for your purchase</p>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-white/20">{invoice.shopName} Ã‚• TechBill POS</p>
        </div>
      </div>
    </div>
  );
}
