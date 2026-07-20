import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ShieldCheck, ShieldX, Clock, Package, CheckCircle } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

interface PublicItem {
  id: string;
  sellingPrice: number;
  serialNumber: string;
  productName: string;
  productBrand: string | null;
  warrantyMonths: number;
  warrantyExpiresAt: string | null;
  warrantyDaysLeft: number | null;
  isReturned?: boolean;
}

interface PublicInvoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  additionalCharges?: number;
  description?: string;
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

const formatPKR = (n: number) => `₨ ${Number(n).toLocaleString('en-PK')}`;

function WarrantyBadge({ item, isReturned }: { item: PublicItem; isReturned: boolean }) {
  if (isReturned) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-amber-50 border-amber-200 text-amber-700">
        <Package size={16} className="text-amber-400" />
        <span className="font-semibold">Returned</span>
      </div>
    );
  }
  if (!item.warrantyMonths || item.warrantyMonths <= 0) {
    return <span className="text-xs text-gray-400 italic">No warranty</span>;
  }
  const days = item.warrantyDaysLeft ?? 0;
  const expired = days < 0;
  const expiresAt = item.warrantyExpiresAt ? format(new Date(item.warrantyExpiresAt), 'dd MMM yyyy') : '';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
      expired
        ? 'bg-red-50 border-red-200 text-red-700'
        : days <= 30
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldX size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Invoice Not Found</h1>
        <p className="text-sm text-gray-500 max-w-xs">{error || 'This invoice link is invalid or does not exist.'}</p>
      </div>
    );
  }

  const saleDate = new Date(invoice.createdAt);
  const hasDiscount = invoice.discountAmount > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* Card */}
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-600 font-semibold font-mono">Verified Invoice</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{invoice.shopName}</h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <CheckCircle size={13} />
            VERIFIED
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg relative">
          
          {/* Watermark */}
          {(invoice.status === 'partial_return' || invoice.status === 'voided' || invoice.shippingStatus === 'returned' || invoice.items.some(i => i.isReturned)) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
              <span
                className="text-6xl font-black uppercase whitespace-nowrap text-red-500"
                style={{ transform: 'rotate(-30deg)', opacity: 0.07 }}
              >
                {invoice.status === 'voided' ? 'VOID' : (invoice.shippingStatus === 'returned' ? 'RETURNED' : 'PARTIAL RETURN')}
              </span>
            </div>
          )}

          {/* Invoice meta */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 relative z-10">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Invoice</p>
            <p className="font-mono font-bold text-gray-900 text-lg">{invoice.invoiceNumber}</p>
            <p className="text-xs text-gray-400 mt-1 tabular-nums">{format(saleDate, 'dd MMM yyyy, h:mm a')}</p>
          </div>

          {/* Customer */}
          {(invoice.customerName || invoice.cashierName) && (
            <div className="px-6 py-4 border-b border-gray-100 relative z-10">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Sold To</p>
              {invoice.customerName && (
                <p className="text-sm font-medium text-gray-900">{invoice.customerName}</p>
              )}
              {invoice.customerPhone && (
                <p className="text-xs font-mono text-gray-500 mt-0.5">{invoice.customerPhone}</p>
              )}
              {invoice.cashierName && (
                <p className="text-xs text-gray-400 mt-1">Cashier · {invoice.cashierName}</p>
              )}
            </div>
          )}

          {/* Items with warranty */}
          <div className="px-6 py-4 border-b border-gray-100 relative z-10">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Items & Warranty</p>
            <div className="space-y-5">
              {invoice.items.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{item.productName}</p>
                      {item.productBrand && (
                        <p className="text-[11px] text-gray-400">{item.productBrand}</p>
                      )}
                      <p className="text-[11px] font-mono text-teal-600 mt-0.5">SN · {item.serialNumber}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatPKR(item.sellingPrice)}</p>
                  </div>
                  {/* Warranty status */}
                  <WarrantyBadge item={item} isReturned={Boolean(item.isReturned || invoice.status === 'voided' || invoice.shippingStatus === 'returned')} />
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 space-y-2 relative z-10">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums text-gray-700">{formatPKR(invoice.subtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="tabular-nums text-rose-600">− {formatPKR(invoice.discountAmount)}</span>
              </div>
            )}
            {Number(invoice.additionalCharges) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Additional Charges</span>
                <span className="tabular-nums text-emerald-700">+ {formatPKR(Number(invoice.additionalCharges))}</span>
              </div>
            )}
            {invoice.description && (
              <div className="text-xs text-gray-400 mt-1 italic">
                Note: {invoice.description}
              </div>
            )}
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase tracking-widest text-gray-500">Total</span>
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{formatPKR(invoice.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">Payment</span>
              <span className="px-2.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-700">
                {PAYMENT_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-1">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Package size={14} />
            <p className="text-xs">Thank you for your purchase</p>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-gray-300">{invoice.shopName}</p>
        </div>
      </div>
    </div>
  );
}
