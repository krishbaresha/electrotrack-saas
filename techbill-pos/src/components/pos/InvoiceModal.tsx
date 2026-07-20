import { X, Printer, Plus, Download, ChevronDown, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useRef } from 'react';
import type { Sale, ShopSettings } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { useFeatureGate } from '../../hooks/useFeatureGate';

interface InvoiceModalProps {
  sale: Sale;
  shopSettings?: ShopSettings | null;
  shopName?: string;
  onClose: () => void;
}

type PageSize = 'A4' | 'A5' | 'A3' | 'invoice';

const PAGE_SIZES: { label: string; value: PageSize; mmW: number; mmH: number | 'auto' }[] = [
  { label: 'A4',      value: 'A4',      mmW: 210, mmH: 297 },
  { label: 'A5',      value: 'A5',      mmW: 148, mmH: 210 },
  { label: 'A3',      value: 'A3',      mmW: 297, mmH: 420 },
  { label: 'Invoice', value: 'invoice', mmW: 80,  mmH: 'auto' },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

const PAYMENT_BADGE_STYLES: Record<string, { background: string; color: string; border: string }> = {
  cash:          { background: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  easypaisa:     { background: '#f0fdf4', color: '#166534', border: '#86efac' },
  jazzcash:      { background: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  card:          { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  bank_transfer: { background: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
};

function formatCurrency(value: number): string {
  return `Rs. ${Number(value).toLocaleString('en-PK')}`;
}

function getPaymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method.replace(/_/g, ' ');
}

function getPaymentBadgeStyle(method: string) {
  return PAYMENT_BADGE_STYLES[method] ?? { background: '#f9fafb', color: '#374151', border: '#e5e7eb' };
}

function getWarrantyText(warrantyDays: number, saleDate: Date): string {
  if (!warrantyDays || warrantyDays <= 0) return '';
  const expiryDate = addDays(saleDate, warrantyDays);
  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'Expired';
  return `${daysLeft} days left (until ${format(expiryDate, 'dd MMM yyyy')})`;
}

export default function InvoiceModal({ sale, shopSettings, shopName, onClose }: InvoiceModalProps) {
  const tenantName = useAuthStore((s) => s.user?.tenantName);
  const resolvedShopName = shopSettings?.shopName ?? shopName ?? tenantName ?? 'TechBill';

  const { limits } = useFeatureGate();
  const isAdvanced = limits.qrInvoices;

  const accentColor = isAdvanced ? (shopSettings?.invoiceAccentColor ?? '#0f766e') : '#0f766e';
  const fontFamily = isAdvanced ? (shopSettings?.invoiceFontFamily ?? 'Inter') : 'system-ui, sans-serif';
  const footerNotes = shopSettings?.invoiceFooterNotes ?? null;
  const showWatermark = isAdvanced ? (shopSettings?.invoiceShowWatermark ?? false) : false;
  const watermarkText = isAdvanced ? (shopSettings?.invoiceWatermarkText ?? '') : '';
  const logoUrl = isAdvanced ? (shopSettings?.logoUrl ?? null) : null;

  const [pageSize, setPageSize] = useState<PageSize>('A4');
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const subtotal = sale.items.reduce((s, i) => s + Number(i.sellingPrice), 0);
  const discount = Number(sale.discountAmount);
  const total = Number(sale.totalAmount);
  const saleDate = new Date(sale.createdAt);

  const returnedUnitIds = new Set(sale.returns?.map(r => r.inventoryUnitId) || []);
  const isSaleVoided = sale.status === 'voided' || sale.shippingStatus === 'returned';
  const hasReturns = (sale.returns && sale.returns.length > 0) || sale.status === 'partial_return';

  const publicInvoiceUrl = `${window.location.origin}/public/invoice/${sale.id}`;

  const handlePrint = (): void => {
    window.print();
  };

  const handleDownloadPDF = async (): Promise<void> => {
    const element = invoiceRef.current;
    if (!element || pdfLoading) return;

    setPdfLoading(true);
    try {
      const selected = PAGE_SIZES.find(p => p.value === pageSize) ?? PAGE_SIZES[0];

      // Clone the invoice element to avoid any scroll/overflow clipping issues
      const clone = element.cloneNode(true) as HTMLElement;

      // Apply fixed-width inline styles so layout matches exactly regardless of viewport
      const widthPx = selected.mmW * (96 / 25.4); // convert mm → px at 96dpi
      clone.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: ${widthPx}px;
        background: #ffffff;
        color: #111111;
        font-family: ${fontFamily}, system-ui, sans-serif;
        box-sizing: border-box;
        overflow: visible;
        border-radius: 0;
        box-shadow: none;
      `;

      // Force all text/border colors to be print-safe
      const allEls = clone.querySelectorAll<HTMLElement>('*');
      allEls.forEach(el => {
        const cs = window.getComputedStyle(el);
        // Strip backgrounds that are near-transparent (badges etc. — keep solid ones)
        const bg = cs.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          el.style.backgroundColor = bg;
        }
        // Ensure text is dark
        const color = cs.color;
        if (color) el.style.color = color;
        el.style.borderColor = cs.borderColor;
      });

      document.body.appendChild(clone);

      // Measure actual rendered height AFTER appending to DOM
      const cloneHeightMm = clone.scrollHeight * (25.4 / 96);

      let pdfFormat: [number, number] | string;
      if (selected.mmH === 'auto') {
        pdfFormat = [selected.mmW, Math.max(80, cloneHeightMm)];
      } else if (selected.mmH < cloneHeightMm) {
        // Content taller than page — use content height (single page)
        pdfFormat = [selected.mmW, cloneHeightMm];
      } else {
        pdfFormat = [selected.mmW, selected.mmH];
      }

      const opt = {
        margin: 0,
        filename: `Invoice_${sale.invoiceNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.85 },
        html2canvas: {
          scale: 2,              // 2 = ~192dpi — balanced quality vs file size
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: widthPx,       // lock canvas width = cloned element width
          scrollX: 0,
          scrollY: 0,
          windowWidth: widthPx,
        },
        jsPDF: {
          unit: 'mm',
          format: pdfFormat,
          orientation: 'portrait' as const,
          compress: true,        // enable PDF-level compression
        },
      };

      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set(opt).from(clone).save();

      document.body.removeChild(clone);
    } finally {
      setPdfLoading(false);
    }
  };

  const selectedSizeLabel = PAGE_SIZES.find(p => p.value === pageSize)?.label ?? 'A4';

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${pageSize === 'invoice' ? '80mm auto' : pageSize};
            margin: ${pageSize === 'invoice' ? '0' : '10mm'};
          }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: fixed !important;
            left: 0; top: 0;
            width: ${pageSize === 'invoice' ? '80mm' : '100%'} !important;
            background: #ffffff !important;
            color: #111111 !important;
            padding: ${pageSize === 'invoice' ? '6mm 5mm' : '0'} !important;
            font-family: ${fontFamily}, system-ui, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          #invoice-print-area * {
            color: inherit !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <div className="w-full max-w-[520px] max-h-[94vh] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0 no-print bg-gray-50">
            <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400 font-medium">Invoice</p>
            <div className="flex items-center gap-1.5">

              {/* Page Size Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowSizeMenu(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-white rounded-lg transition-all"
                >
                  {selectedSizeLabel}
                  <ChevronDown size={11} />
                </button>
                {showSizeMenu && (
                  <div className="absolute right-0 mt-1 w-28 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
                    {PAGE_SIZES.map(ps => (
                      <button
                        key={ps.value}
                        onClick={() => { setPageSize(ps.value); setShowSizeMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          pageSize === ps.value
                            ? 'bg-teal-50 text-teal-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {ps.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-white rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {pdfLoading ? 'Generating...' : 'PDF'}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-white rounded-lg transition-all"
              >
                <Printer size={13} />
                Print
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-all"
              >
                <Plus size={13} />
                New Sale
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-1 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Invoice Body */}
          <div className="overflow-auto flex-1">
            <div
              id="invoice-print-area"
              ref={invoiceRef}
              className="relative bg-white text-gray-900"
              style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}
            >
              {/* Watermark */}
              {isSaleVoided ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                  <span
                    className="text-6xl font-black uppercase whitespace-nowrap"
                    style={{ transform: 'rotate(-30deg)', color: '#ef4444', opacity: 0.08 }}
                  >
                    {sale.status === 'voided' ? 'VOID' : 'RETURNED'}
                  </span>
                </div>
              ) : hasReturns ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                  <span
                    className="text-6xl font-black uppercase whitespace-nowrap"
                    style={{ transform: 'rotate(-30deg)', color: '#ef4444', opacity: 0.08 }}
                  >
                    PARTIAL RETURN
                  </span>
                </div>
              ) : (showWatermark && watermarkText) ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                  <span
                    className="text-6xl font-black uppercase whitespace-nowrap"
                    style={{ transform: 'rotate(-30deg)', color: '#000000', opacity: 0.04 }}
                  >
                    {watermarkText}
                  </span>
                </div>
              ) : null}

              {/* Header */}
              <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #f3f4f6', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt={resolvedShopName}
                        style={{ height: '40px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>
                        {resolvedShopName}
                      </h2>
                      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#9ca3af', marginTop: '6px' }}>
                        Invoice · <span style={{ fontFamily: 'monospace', textTransform: 'none', letterSpacing: 'normal', color: '#4b5563' }}>{sale.invoiceNumber}</span>
                      </p>
                    </div>
                  </div>
                  {isAdvanced && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '9999px' }}>
                      ✓ VERIFIED
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '10px' }}>
                  {format(saleDate, 'dd MMM yyyy, h:mm a')}
                </p>
              </div>

              {/* Sold To */}
              <div style={{ padding: '18px 28px', borderBottom: '1px solid #f3f4f6', position: 'relative', zIndex: 10 }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: '#9ca3af', marginBottom: '10px' }}>Sold To</p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                    {sale.customer?.name ?? 'Walk-in Customer'}
                  </span>
                  {!sale.customer && (
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af' }}>Walk-in</span>
                  )}
                </div>
                {sale.customer?.phone && (
                  <p style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280', marginTop: '4px' }}>{sale.customer.phone}</p>
                )}
                {sale.soldBy?.name && (
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                    Cashier · <span style={{ color: '#4b5563' }}>{sale.soldBy.name}</span>
                  </p>
                )}
              </div>

              {/* Items */}
              <div style={{ padding: '18px 28px', borderBottom: '1px solid #f3f4f6', position: 'relative', zIndex: 10 }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: '#9ca3af', marginBottom: '14px' }}>Items</p>
                <div>
                  {sale.items.map((item, idx) => {
                    const product = item.inventoryUnit?.product;
                    const serial = item.inventoryUnit?.serialNumber;
                    const wDays = product?.warrantyMonths ?? 0;
                    const isItemReturned = isSaleVoided || returnedUnitIds.has(item.inventoryUnit?.id);
                    const warrantyText = isItemReturned ? '' : getWarrantyText(wDays, saleDate);
                    return (
                      <div key={item.id ?? idx} style={{ marginBottom: idx < sale.items.length - 1 ? '14px' : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, lineHeight: 1.4 }}>
                            {product?.name ?? 'Item'}
                          </p>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(item.sellingPrice)}
                          </p>
                        </div>
                        {product?.brand && (
                          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{product.brand}</p>
                        )}
                        {serial && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            <p style={{ fontSize: '11px', fontFamily: 'monospace', color: accentColor, margin: 0 }}>
                              SN · {serial}
                            </p>
                            {isItemReturned && (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca', textTransform: 'uppercase' }}>Returned</span>
                            )}
                          </div>
                        )}
                        {warrantyText && (
                          <p style={{ fontSize: '10px', color: '#9ca3af', margin: '3px 0 0' }}>
                            Warranty: {warrantyText}
                          </p>
                        )}
                        {idx < sale.items.length - 1 && (
                          <div style={{ height: '1px', background: '#f3f4f6', marginTop: '14px' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals */}
              <div style={{ padding: '18px 28px', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#6b7280' }}>Discount</span>
                    <span style={{ color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>− {formatCurrency(discount)}</span>
                  </div>
                )}
                {Number(sale.additionalCharges) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#6b7280' }}>Additional Charges</span>
                    <span style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>+ {formatCurrency(Number(sale.additionalCharges))}</span>
                  </div>
                )}
                {sale.description && (
                  <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', marginTop: '4px' }}>
                    Note: {sale.description}
                  </p>
                )}
                <div style={{ height: '1px', background: '#e5e7eb', margin: '12px 0' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: '#6b7280' }}>Total</span>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(total)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Payment</span>
                  {(() => {
                    const badge = getPaymentBadgeStyle(sale.paymentMethod);
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: badge.background, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: '9999px' }}>
                        {getPaymentLabel(sale.paymentMethod)}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ height: '1px', background: '#f3f4f6', margin: '0 28px' }} />

              {/* QR / Footer */}
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 10 }}>
                {isAdvanced ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    {/* QR code rendered at exact pixel size — no scaling artifacts */}
                    <div style={{ padding: '10px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
                      <QRCodeSVG
                        value={publicInvoiceUrl}
                        size={80}
                        level="M"
                        fgColor="#111111"
                        bgColor="#ffffff"
                      />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#9ca3af' }}>Scan to verify</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>{sale.invoiceNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#9ca3af' }}>Receipt Ref · {sale.invoiceNumber}</p>
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#374151' }}>Thank you for your purchase</p>
                  {footerNotes && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', maxWidth: '280px', margin: '6px auto 0', lineHeight: 1.6 }}>{footerNotes}</p>
                  )}
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: '#d1d5db', marginTop: '6px' }}>
                    {resolvedShopName}
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
