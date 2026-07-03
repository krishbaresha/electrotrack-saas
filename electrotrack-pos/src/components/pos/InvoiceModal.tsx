import { X, Printer, Plus, Download } from 'lucide-react';
import { format, addMonths, differenceInDays } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import html2pdf from 'html2pdf.js';
import type { Sale, ShopSettings } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { useFeatureGate } from '../../hooks/useFeatureGate';

interface InvoiceModalProps {
  sale: Sale;
  shopSettings?: ShopSettings | null;
  shopName?: string;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

const PAYMENT_BADGE_CLASSES: Record<string, string> = {
  cash: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  easypaisa: 'bg-green-500/15 text-green-300 border-green-400/30',
  jazzcash: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
  card: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  bank_transfer: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
};

function formatCurrency(value: number): string {
  return `₨ ${Number(value).toLocaleString('en-PK')}`;
}

function getPaymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method.replace(/_/g, ' ');
}

function getPaymentBadgeClass(method: string): string {
  return PAYMENT_BADGE_CLASSES[method] ?? 'bg-white/10 text-white/70 border-white/20';
}

function getWarrantyText(warrantyMonths: number, saleDate: Date): string {
  if (!warrantyMonths || warrantyMonths <= 0) return '';
  const expiryDate = addMonths(saleDate, warrantyMonths);
  const daysLeft = differenceInDays(expiryDate, new Date());
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} days ago`;
  if (daysLeft === 0) return 'Expires today';
  return `${daysLeft} days left (until ${format(expiryDate, 'dd MMM yyyy')})`;
}

export default function InvoiceModal({ sale, shopSettings, shopName, onClose }: InvoiceModalProps) {
  const tenantName = useAuthStore((s) => s.user?.tenantName);
  const resolvedShopName = shopSettings?.shopName ?? shopName ?? tenantName ?? 'ElectroTrack';

  const { limits } = useFeatureGate();
  const isAdvanced = limits.qrInvoices;

  const accentColor = isAdvanced ? (shopSettings?.invoiceAccentColor ?? '#14b8a6') : '#ffffff';
  const primaryColor = isAdvanced ? (shopSettings?.invoicePrimaryColor ?? '#ffffff') : '#ffffff';
  const fontFamily = isAdvanced ? (shopSettings?.invoiceFontFamily ?? 'Inter') : 'system-ui, sans-serif';
  const footerNotes = shopSettings?.invoiceFooterNotes ?? null;
  const showWatermark = isAdvanced ? (shopSettings?.invoiceShowWatermark ?? false) : false;
  const watermarkText = isAdvanced ? (shopSettings?.invoiceWatermarkText ?? '') : '';
  const logoUrl = isAdvanced ? (shopSettings?.logoUrl ?? null) : null;

  const subtotal = sale.items.reduce((s, i) => s + Number(i.sellingPrice), 0);
  const discount = Number(sale.discountAmount);
  const total = Number(sale.totalAmount);
  const saleDate = new Date(sale.createdAt);

  // Secure UUID-based URL — no sequential IDs, prevents IDOR attacks
  const publicInvoiceUrl = `${window.location.origin}/public/invoice/${sale.id}`;

  const handlePrint = (): void => {
    window.print();
  };

  const handleDownloadPDF = (): void => {
    const element = document.getElementById('invoice-print-area');
    if (!element) return;
    
    // Calculate the actual height of the element in millimeters
    const pxToMm = 25.4 / 96; // 1 pixel = 25.4 mm / 96 DPI
    const elementHeightMm = element.scrollHeight * pxToMm;
    const pageHeight = Math.max(200, elementHeightMm);

    const opt = {
      margin: 0,
      filename: `Receipt_${sale.invoiceNumber}.pdf`,
      image: { type: 'jpeg' as const, quality: 1 },
      html2canvas: { scale: 3, useCORS: true, backgroundColor: '#09090b' },
      jsPDF: { unit: 'mm', format: [80, pageHeight] as [number, number], orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: fixed !important;
            left: 0; top: 0;
            width: 80mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 8mm 6mm !important;
            font-size: 10pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #invoice-print-area * {
            color: #000000 !important;
            border-color: #cccccc !important;
            background: transparent !important;
          }
          #invoice-print-area .print-total { font-size: 13pt !important; font-weight: bold !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-[480px] max-h-[94vh] flex flex-col bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0 no-print">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Receipt</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/25 hover:bg-white/5 rounded-lg transition-all"
              >
                <Download size={13} />
                PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/25 hover:bg-white/5 rounded-lg transition-all"
              >
                <Printer size={13} />
                Print
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-900 bg-white hover:bg-white/90 rounded-lg transition-all"
              >
                <Plus size={13} />
                New Sale
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-1 p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-auto flex-1">
            <div
              id="invoice-print-area"
              className="relative bg-zinc-950 text-white"
              style={{
                fontFamily: `${fontFamily}, system-ui, sans-serif`,
                backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 30%)',
              }}
            >
              {/* Watermark */}
              {(showWatermark && watermarkText) || sale.status === 'returned' || sale.status === 'void' || sale.shippingStatus === 'returned' ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                  <span
                    className={`text-6xl font-black uppercase whitespace-nowrap ${(sale.status === 'returned' || sale.status === 'void' || sale.shippingStatus === 'returned') ? 'opacity-[0.15]' : 'opacity-[0.04]'}`}
                    style={{ 
                      transform: 'rotate(-30deg)', 
                      color: (sale.status === 'returned' || sale.status === 'void' || sale.shippingStatus === 'returned') ? '#ef4444' : primaryColor 
                    }}
                  >
                    {sale.status === 'void' ? 'VOID' : (sale.status === 'returned' || sale.shippingStatus === 'returned' ? 'RETURNED' : watermarkText)}
                  </span>
                </div>
              ) : null}

              <div className="px-7 pt-7 pb-5 relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt={resolvedShopName}
                        className="h-10 w-auto object-contain rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-medium tracking-tight leading-tight" style={{ color: primaryColor }}>
                        {resolvedShopName}
                      </h2>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 mt-1.5">
                        Tax Invoice · <span className="font-mono normal-case tracking-normal text-white/60">{sale.invoiceNumber}</span>
                      </p>
                    </div>
                  </div>
                  {isAdvanced && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 rounded-full">
                      <span className="text-[11px] leading-none">✓</span> VERIFIED
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-3 tabular-nums">
                  {format(saleDate, 'dd MMM yyyy, h:mm a')}
                </p>
              </div>

              <div className="h-px bg-white/10 mx-7" />

              <div className="px-7 py-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-3">Sold To</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-white font-medium">
                      {sale.customer?.name ?? 'Walk-in Customer'}
                    </span>
                    {!sale.customer && (
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Walk-in</span>
                    )}
                  </div>
                  {sale.customer?.phone && (
                    <p className="text-white/60 font-mono text-xs">{sale.customer.phone}</p>
                  )}
                  {sale.soldBy?.name && (
                    <p className="text-white/50 text-xs pt-1">
                      Cashier · <span className="text-white/70">{sale.soldBy.name}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/10 mx-7" />

              <div className="px-7 py-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-4">Items</p>
                <div className="space-y-4">
                  {sale.items.map((item, idx) => {
                    const product = item.inventoryUnit?.product;
                    const serial = item.inventoryUnit?.serialNumber;
                    const wMonths = product?.warrantyMonths ?? 0;
                    const isSaleReturned = sale.status === 'returned' || sale.status === 'void' || sale.shippingStatus === 'returned';
                    const warrantyText = isSaleReturned ? '' : getWarrantyText(wMonths, saleDate);
                    return (
                      <div key={item.id ?? idx} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm text-white font-medium leading-snug">
                            {product?.name ?? 'Item'}
                          </p>
                          <p className="text-sm text-white tabular-nums whitespace-nowrap font-medium">
                            {formatCurrency(item.sellingPrice)}
                          </p>
                        </div>
                        {product?.brand && (
                          <p className="text-[11px] text-white/45">{product.brand}</p>
                        )}
                        {serial && (
                          <p className="text-[11px] font-mono" style={{ color: accentColor, opacity: 0.8 }}>
                            SN · {serial}
                          </p>
                        )}
                        {warrantyText && (
                          <p className="text-[10px] text-white/35">
                            Warranty: {warrantyText}
                          </p>
                        )}
                        {idx < sale.items.length - 1 && (
                          <div className="h-px bg-white/5 mt-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-white/10 mx-7" />

              <div className="px-7 py-5 space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-white/55">Subtotal</span>
                  <span className="text-white/80 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-white/55">Discount</span>
                    <span className="text-rose-300 tabular-nums">− {formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="h-px bg-white/15 my-3" />
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/50">Total</span>
                  <span className="text-2xl font-medium text-white tabular-nums tracking-tight print-total">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-white/50">Payment</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase border rounded-full ${getPaymentBadgeClass(sale.paymentMethod)}`}
                  >
                    {getPaymentLabel(sale.paymentMethod)}
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/10 mx-7" />

              {/* Real QR Code or Basic Receipt Footer */}
              <div className="px-7 py-7 flex flex-col items-center gap-4">
                {isAdvanced ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-white rounded-xl">
                      <QRCodeSVG
                        value={publicInvoiceUrl}
                        size={96}
                        level="H"
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Scan to verify</p>
                      <p className="font-mono text-xs text-white/80 mt-1">{sale.invoiceNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-mono text-xs text-white/50 mt-1">Receipt Ref · {sale.invoiceNumber}</p>
                  </div>
                )}
                <div className="text-center pt-2 space-y-1">
                  <p className="text-sm text-white/80">Thank you for your purchase</p>
                  {footerNotes && (
                    <p className="text-xs text-white/50 max-w-xs mx-auto mt-2 leading-relaxed">{footerNotes}</p>
                  )}
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/35 mt-1">
                    {resolvedShopName} · ElectroTrack POS
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
