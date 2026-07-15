import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Camera, Package, Barcode, Loader, Tag } from 'lucide-react';

import BarcodeScanner from './BarcodeScanner';
import { useInventoryStore } from '../../store/inventory.store';

interface Props {
  onSerialAdd: (serial: string) => void;
  onProductSelect: (product: SearchProduct) => void;
  loading?: boolean;
}

export interface SearchProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  sellingPrice: number | string;
  inStockCount?: number;
  tags?: string[];
  specifications?: Record<string, string> | null;
  shortDescription?: string | null;
}

interface ProductSuggestion {
  kind: 'product';
  product: SearchProduct;
}

interface SerialSuggestion {
  kind: 'serial';
  value: string;
}

type Suggestion = ProductSuggestion | SerialSuggestion;

const DEBOUNCE_MS = 200;
const SERIAL_PATTERN = /^[A-Za-z0-9-]{6,}$/;
const MAX_PRODUCT_SUGGESTIONS = 6;

function formatPkr(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '₨ 0';
  return `₨ ${num.toLocaleString('en-PK')}`;
}

function looksLikeSerial(input: string): boolean {
  return SERIAL_PATTERN.test(input.trim());
}

export default function UniversalSearch({
  onSerialAdd,
  onProductSelect,
  loading = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const products = useInventoryStore((s) => s.products);
  const isSyncing = useInventoryStore((s) => s.isSyncing);
  const syncProducts = useInventoryStore((s) => s.syncProducts);

  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger background sync on mount, but instantly use cached products
  useEffect(() => {
    syncProducts();
  }, [syncProducts]);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Reposition dropdown on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (inputWrapperRef.current) {
        setDropdownRect(inputWrapperRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < 2) return [];

    const productMatches: ProductSuggestion[] = products
      .filter((p) => {
        const specValues = p.specifications
          ? Object.values(p.specifications as Record<string, string>).join(' ')
          : '';
        const haystack = [
          p.name, p.brand ?? '', p.category ?? '',
          ...(p.tags ?? []),
          specValues,
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, MAX_PRODUCT_SUGGESTIONS)
      .map((product) => ({ kind: 'product' as const, product }));

    const raw = debouncedQuery.trim();
    const serial: SerialSuggestion[] = looksLikeSerial(raw)
      ? [{ kind: 'serial' as const, value: raw.toUpperCase() }]
      : [];

    return [...productMatches, ...serial];
  }, [debouncedQuery, products]);

  const updateRect = () => {
    if (inputWrapperRef.current) {
      setDropdownRect(inputWrapperRef.current.getBoundingClientRect());
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);
    if (value.trim().length >= 2) {
      updateRect();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const commitSuggestion = (s: Suggestion) => {
    if (s.kind === 'product') {
      onProductSelect(s.product);
    } else {
      onSerialAdd(s.value);
    }
    setQuery('');
    setOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSelectedIndex(-1);
      return;
    }

    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') {
        const raw = query.trim();
        if (looksLikeSerial(raw)) {
          onSerialAdd(raw.toUpperCase());
          setQuery('');
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        commitSuggestion(suggestions[selectedIndex]);
      } else {
        const raw = query.trim();
        if (looksLikeSerial(raw)) {
          onSerialAdd(raw.toUpperCase());
          setQuery('');
          setOpen(false);
        }
      }
    }
  };

  const handleScan = (decoded: string) => {
    setScannerOpen(false);
    onSerialAdd(decoded.toUpperCase());
    setQuery('');
    setOpen(false);
  };

  const productSuggestions = suggestions.filter(
    (s): s is ProductSuggestion => s.kind === 'product',
  );
  const serialSuggestions = suggestions.filter(
    (s): s is SerialSuggestion => s.kind === 'serial',
  );

  const renderProductRow = (s: ProductSuggestion, absoluteIndex: number) => {
    const isSelected = absoluteIndex === selectedIndex;
    const stock = s.product.inStockCount ?? 0;
    return (
      <button
        key={s.product.id}
        type="button"
        data-testid="search-result-item"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commitSuggestion(s)}
        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
          isSelected ? 'bg-stitch-primary/20' : 'hover:bg-white/5'
        }`}
      >
        <Package size={14} className="text-stitch-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stitch-on-surface truncate font-medium">
            {s.product.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {s.product.brand && (
              <span className="text-[11px] text-stitch-on-surface-variant truncate">
                {s.product.brand}
              </span>
            )}
            {s.product.category && (
              <span className="inline-flex items-center gap-1 text-[10px] text-stitch-on-surface-variant">
                <Tag size={8} />
                {s.product.category}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs font-mono text-stitch-tertiary tabular-nums">
            {formatPkr(s.product.sellingPrice)}
          </span>
          {s.product.inStockCount !== undefined && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                stock > 0
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-stitch-error/15 text-stitch-error'
              }`}
            >
              {stock > 0 ? `${stock} in stock` : 'Out'}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderSerialRow = (s: SerialSuggestion, absoluteIndex: number) => {
    const isSelected = absoluteIndex === selectedIndex;
    return (
      <button
        key={`serial-${s.value}`}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commitSuggestion(s)}
        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
          isSelected ? 'bg-stitch-tertiary/20' : 'hover:bg-white/5'
        }`}
      >
        <Barcode size={14} className="text-stitch-tertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-stitch-on-surface-variant">Lookup serial</p>
          <p className="text-sm font-mono text-stitch-tertiary truncate">{s.value}</p>
        </div>
        <span className="text-[10px] text-stitch-on-surface-variant uppercase tracking-wide">
          Enter
        </span>
      </button>
    );
  };

  const dropdown =
    open && suggestions.length > 0 && dropdownRect
      ? createPortal(
          <div
            className="glass-modal rounded-lg border border-white/10 shadow-2xl overflow-hidden"
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
          >
            {productSuggestions.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-stitch-surface-container-high/60 border-b border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stitch-on-surface-variant">
                    Products
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {productSuggestions.map((s, idx) => renderProductRow(s, idx))}
                </div>
              </>
            )}
            {serialSuggestions.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-stitch-surface-container-high/60 border-y border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stitch-on-surface-variant">
                    Direct Serial
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {serialSuggestions.map((s, idx) =>
                    renderSerialRow(s, productSuggestions.length + idx),
                  )}
                </div>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={inputWrapperRef} className="relative w-full">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant pointer-events-none"
            />
            {isSyncing && (
              <Loader
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stitch-primary animate-spin"
              />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query.trim().length >= 2 && suggestions.length > 0) {
                  updateRect();
                  setOpen(true);
                }
              }}
              placeholder="Search product, brand, IMEI, serial, category..."
              disabled={loading}
              className="w-full pl-9 pr-10 py-3 bg-stitch-surface-container-high/50 border border-white/10 rounded-lg text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/60 focus:ring-1 focus:ring-stitch-primary/30 transition-all placeholder:text-stitch-on-surface-variant/60 disabled:opacity-50"
            />
            {loading && (
              <Loader
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant animate-spin"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            title="Scan barcode"
            className="flex items-center justify-center w-11 h-11 border border-white/10 bg-stitch-surface-container-high/50 text-stitch-on-surface-variant hover:bg-white/10 hover:text-white rounded-lg transition-colors shrink-0"
          >
            <Camera size={16} />
          </button>
        </div>
      </div>

      {dropdown}

      {scannerOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
      )}
    </>
  );
}
