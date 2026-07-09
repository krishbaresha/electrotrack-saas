import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShoppingCart, Package, AlertTriangle, Layers, User, X, Plus, TrendingUp, Clock, Zap, ChevronLeft } from 'lucide-react';
import gsap from 'gsap';
import UniversalSearch, { type SearchProduct } from '../../components/pos/UniversalSearch';
import ProductGrid from '../../components/pos/ProductGrid';
import CartTable from '../../components/pos/CartTable';
import PaymentForm from '../../components/pos/PaymentForm';
import InvoiceModal from '../../components/pos/InvoiceModal';
import { useCartStore } from '../../store/cart.store';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../api/client';
import { usePosStore } from '../../store/pos.store';
import type { Sale, ShopSettings, ProductCard, DashboardData } from '../../types';
import { useToastStore } from '../../store/toast.store';
import { CardSkeleton, StatsSkeleton } from '../../components/common/Skeleton';


interface InventoryUnit {
  id: string;
  serialNumber: string;
  condition: string | null;
  status: string;
  sellingPrice: number;
  productId: string;
  productName?: string;
  brand?: string | null;
}

type StatusFilter = 'in_stock' | 'all' | 'sold' | 'returned';

const STATUS_LABELS: Record<StatusFilter, string> = {
  in_stock: 'In Stock',
  all: 'All Items',
  sold: 'Sold',
  returned: 'Returned',
};

const formatPKR = (n: number): string => `₨ ${n.toLocaleString('en-PK')}`;

export default function PosScreen() {
  const toast = useToastStore();
  const dashboard = usePosStore((s) => s.dashboardData);
  const syncPosDashboard = usePosStore((s) => s.syncPosDashboard);
  const deltaSync = usePosStore((s) => s.deltaSync);

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('in_stock');
  const [viewingProduct, setViewingProduct] = useState<ProductCard | null>(null);
  // Keep a ref in sync so handleAddUnit can read the current product value
  // without needing a state updater (which StrictMode would double-invoke).
  const viewingProductRef = useRef<ProductCard | null>(null);
  const [unitPickerUnits, setUnitPickerUnits] = useState<InventoryUnit[]>([]);
  const [unitPickerLoading, setUnitPickerLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [now, setNow] = useState(new Date());

  const [mobileView, setMobileView] = useState<'browse' | 'cart'>('browse');

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const user = useAuthStore((s) => s.user);

  const statsRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setDashboardLoading(!dashboard); // Only show loading if no cached data
      
      const settingsPromise = api.get<ShopSettings>('/settings');
      const syncPromise = syncPosDashboard();
      
      const [, settingsRes] = await Promise.allSettled([syncPromise, settingsPromise]);
      
      if (!mounted) return;
      if (settingsRes.status === 'fulfilled') setShopSettings(settingsRes.value.data);
      
      setDashboardLoading(false);
    })();
    return () => { mounted = false; };
  }, [syncPosDashboard]);

  // Background delta-sync: runs every 5 minutes to silently patch the local
  // cache with changed rows from Supabase, bypassing the NestJS backend.
  useEffect(() => {
    const id = setInterval(() => { deltaSync(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [deltaSync]);

  useEffect(() => {
    if (!dashboard) return;
    const ctx = gsap.context(() => {
      if (statsRef.current) {
        gsap.fromTo(statsRef.current.children,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' });
      }
      if (pillsRef.current) {
        gsap.fromTo(pillsRef.current.children,
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out', delay: 0.15 });
      }
      if (gridWrapRef.current) {
        gsap.fromTo(gridWrapRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.2 });
      }
    });
    return () => ctx.revert();
  }, [dashboard]);

  const allProducts = useMemo<ProductCard[]>(() => {
    if (!dashboard) return [];
    const map = new Map<string, ProductCard>();
    [...dashboard.recentlyAdded, ...dashboard.fastSelling, ...dashboard.lowStock].forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, p);
    });
    return Array.from(map.values());
  }, [dashboard]);

  const filteredProducts = useMemo<ProductCard[]>(() => {
    return allProducts.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (statusFilter === 'in_stock' && p.inStockCount <= 0) return false;
      if (statusFilter === 'sold' && p.soldCount <= 0) return false;
      if (statusFilter === 'returned' && p.returnedCount <= 0) return false;
      return true;
    });
  }, [allProducts, selectedCategory, statusFilter]);

  const openUnitPicker = useCallback(async (product: ProductCard) => {
    viewingProductRef.current = product;
    setViewingProduct(product);
    setUnitPickerUnits([]);
    setUnitPickerLoading(true);
    try {
      const res = await api.get<any>(
        `/inventory/units?productId=${product.id}&status=in_stock&limit=100`
      );
      const payload = res.data;
      setUnitPickerUnits(Array.isArray(payload) ? payload : payload.data ?? payload.units ?? []);
    } catch {
      setUnitPickerUnits([]);
    } finally {
      setUnitPickerLoading(false);
    }
  // viewingProduct is intentionally excluded — it's only set inside this fn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddUnit = useCallback((unit: InventoryUnit) => {
    // Use the ref (not a state updater) to read the current product.
    // Calling addItem inside a setViewingProduct updater caused React
    // StrictMode to double-invoke it in dev — adding every item twice.
    const product = viewingProductRef.current;
    if (!product) return;
    if (items.some((i) => i.serialNumber === unit.serialNumber)) {
      toast.info(`"${unit.serialNumber}" is already in your cart.`);
      return;
    }
    addItem({
      serialNumber: unit.serialNumber,
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      sellingPrice: unit.sellingPrice ?? product.sellingPrice,
    });
    toast.success(`Added ${product.name} (${unit.serialNumber}) to cart.`);
    setUnitPickerUnits((prev) => prev.filter((u) => u.serialNumber !== unit.serialNumber));
  }, [items, addItem, toast]);

  // Memoized handlers passed down to SectionedGrid / ProductGrid
  // to prevent prop-identity churn on every cart state update.
  const handleAddToCart = useCallback((p: ProductCard) => {
    if (p.inStockCount > 0) openUnitPicker(p);
  }, [openUnitPicker]);

  const handleViewUnits = useCallback((p: ProductCard) => {
    openUnitPicker(p);
  }, [openUnitPicker]);

  const handleProductSelect = useCallback((product: SearchProduct) => {
    openUnitPicker({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      sellingPrice: Number(product.sellingPrice),
      inStockCount: product.inStockCount ?? 0,
      soldCount: 0,
      returnedCount: 0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSerialAdd = useCallback(async (serial: string) => {
    try {
      const res = await api.get<any>(
        `/inventory/units?serialNumber=${encodeURIComponent(serial)}&limit=1`
      );
      const payload = res.data;
      const units = Array.isArray(payload) ? payload : payload.data ?? payload.units ?? [];
      const unit = units[0];

      if (!unit) {
        toast.error(`Serial number "${serial}" not found in inventory.`);
        return;
      }
      if (unit.status === 'in_stock') {
        if (items.some((i) => i.serialNumber === unit.serialNumber)) {
          toast.info(`"${unit.serialNumber}" is already in your cart.`);
          return;
        }
        addItem({
          serialNumber: unit.serialNumber,
          productId: unit.productId,
          productName: unit.productName ?? 'Unknown',
          brand: unit.brand ?? null,
          sellingPrice: unit.sellingPrice,
        });
        toast.success(`Added ${unit.productName ?? 'product'} (${unit.serialNumber}) to cart.`);
      } else {
        toast.warning(`Serial "${unit.serialNumber}" cannot be sold (status: ${unit.status.replace(/_/g, ' ')}).`);
      }
    } catch {
      toast.error(`Failed to look up serial "${serial}".`);
    }
  }, [items, addItem, toast]);

  const closeInvoice = useCallback(() => {
    setCompletedSale(null);
    clearCart();
    toast.success('Sale transaction cleared.');
  }, [clearCart, toast]);

  const dateStr = now.toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short' });
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full flex flex-col bg-stitch-surface">
      <header className="h-14 shrink-0 border-b border-white/5 px-3 sm:px-6 flex items-center justify-between bg-stitch-surface-container/40 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-stitch-primary/15 flex items-center justify-center ring-1 ring-stitch-primary/20 shrink-0">
            <ShoppingCart size={17} className="text-stitch-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-stitch-on-surface font-space leading-tight truncate">Point of Sale</h1>
            <p className="text-[10px] text-stitch-on-surface-variant uppercase tracking-wider truncate">
              {shopSettings?.shopName ?? 'TechBill Retail'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 text-xs">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-stitch-on-surface font-medium tabular-nums">{timeStr}</span>
            <span className="text-[10px] text-stitch-on-surface-variant uppercase tracking-wider">{dateStr}</span>
          </div>
          <div className="hidden sm:block h-7 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-stitch-tertiary/15 flex items-center justify-center ring-1 ring-stitch-tertiary/20 shrink-0">
              <User size={13} className="text-stitch-tertiary" />
            </div>
            <span className="text-stitch-on-surface font-medium truncate max-w-[80px] sm:max-w-none">{user?.name ?? 'Cashier'}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {/* LEFT PANEL */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 gap-4 sm:gap-5 ${mobileView === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          <UniversalSearch onSerialAdd={handleSerialAdd} onProductSelect={handleProductSelect} />

          {/* Notifications handled globally via ToastContainer */}

          {/* Stats Row */}
          {dashboardLoading ? (
            <StatsSkeleton />
          ) : (
            <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<Package size={15} />} label="In Stock" value={dashboard?.stats.totalInStock ?? 0} accent="blue" loading={false} />
              <StatCard icon={<AlertTriangle size={15} />} label="Low Stock" value={dashboard?.stats.totalLowStock ?? 0} accent={dashboard && dashboard.stats.totalLowStock > 0 ? 'red' : 'green'} loading={false} />
              <StatCard icon={<Layers size={15} />} label="Products" value={dashboard?.stats.totalProducts ?? 0} accent="purple" loading={false} />
              <StatCard icon={<TrendingUp size={15} />} label="Total Sold" value={dashboard?.stats.totalSold ?? 0} accent="teal" loading={false} />
            </div>
          )}

          {/* Category Pills */}
          <div ref={pillsRef} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            <Pill active={selectedCategory === null} onClick={() => setSelectedCategory(null)}>All</Pill>
            {(dashboard?.categories ?? []).map((cat) => (
              <Pill key={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>{cat}</Pill>
            ))}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 border-b border-white/5">
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`relative px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  statusFilter === s ? 'text-stitch-primary' : 'text-stitch-on-surface-variant hover:text-stitch-on-surface'
                }`}
              >
                {STATUS_LABELS[s]}
                {statusFilter === s && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-stitch-primary rounded-full" />}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div ref={gridWrapRef} className="flex-1 min-h-0 pb-20 lg:pb-4">
            {dashboardLoading ? (
              <CardSkeleton count={8} />
            ) : filteredProducts.length === 0 && !(selectedCategory === null && statusFilter === 'in_stock') ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <Package size={32} className="text-stitch-on-surface-variant/30" />
                <p className="text-sm text-stitch-on-surface-variant">No products match this filter</p>
                <p className="text-xs text-stitch-on-surface-variant/60">Try a different category or status</p>
              </div>
            ) : selectedCategory === null && statusFilter === 'in_stock' ? (
              <SectionedGrid
                dashboard={dashboard}
                onAddToCart={handleAddToCart}
                onViewUnits={handleViewUnits}
              />
            ) : (
              <ProductGrid
                products={filteredProducts}
                loading={false}
                onAddToCart={handleAddToCart}
                onViewUnits={handleViewUnits}
                selectedCategory={selectedCategory}
              />
            )}
          </div>
          {/* Mobile floating cart button */}
          {items.length > 0 && (
            <div className="lg:hidden fixed bottom-4 inset-x-3 z-20">
              <button
                onClick={() => setMobileView('cart')}
                className="w-full flex items-center justify-between px-4 py-3 bg-stitch-primary text-stitch-on-primary rounded-xl font-bold shadow-lg text-sm"
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart size={16} />
                  View Cart
                </span>
                <span className="tabular-nums">{items.length} {items.length === 1 ? 'item' : 'items'} · ₨ {items.reduce((s, i) => s + i.sellingPrice, 0).toLocaleString('en-PK')}</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <aside className={`shrink-0 border-l border-white/5 bg-stitch-surface-container/30 flex-col min-h-0 ${mobileView === 'browse' ? 'hidden lg:flex lg:w-96' : 'flex w-full lg:w-96'}`}>
          <div className="h-14 shrink-0 px-4 sm:px-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileView('browse')}
                className="lg:hidden flex items-center gap-1 text-stitch-on-surface-variant hover:text-white transition-colors mr-2"
                aria-label="Back to products"
              >
                <ChevronLeft size={16} />
              </button>
              <ShoppingCart size={15} className="text-stitch-primary" />
              <h2 className="text-sm font-bold text-stitch-on-surface font-space">Cart</h2>
            </div>
            <span className="text-[11px] font-semibold text-stitch-on-surface-variant uppercase tracking-wider tabular-nums">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className={`flex-1 min-h-0 ${items.length === 0 ? 'flex flex-col' : 'overflow-y-auto px-4 py-4 space-y-4'}`}>
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col p-4"><CartTable /></div>
            ) : (
              <>
                <div className="min-h-[180px]"><CartTable /></div>
                <PaymentForm onSaleComplete={(sale: Sale) => { setCompletedSale(sale); toast.success('Invoice Generated Successfully!'); }} shopSettings={shopSettings} />
              </>
            )}
          </div>
        </aside>
      </div>

      {viewingProduct && (
        <UnitPickerSheet
          product={viewingProduct}
          units={unitPickerUnits}
          loading={unitPickerLoading}
          onClose={() => {
            setViewingProduct(null);
            viewingProductRef.current = null;
          }}
          onAdd={handleAddUnit}
          cartSerials={items.map((i) => i.serialNumber)}
        />
      )}

      {completedSale && <InvoiceModal sale={completedSale} shopSettings={shopSettings} onClose={closeInvoice} />}
    </div>
  );
}

// ─── Sectioned Grid ──────────────────────────────────────────────────────

interface SectionedGridProps {
  dashboard: DashboardData | null;
  onAddToCart: (p: ProductCard) => void;
  onViewUnits: (p: ProductCard) => void;
}

function SectionedGrid({ dashboard, onAddToCart, onViewUnits }: SectionedGridProps) {
  if (!dashboard) return null;
  const sections: { label: string; icon: React.ReactNode; items: ProductCard[] }[] = [
    { label: 'Low Stock Alert', icon: <AlertTriangle size={13} />, items: dashboard.lowStock },
    { label: 'Recently Added', icon: <Clock size={13} />, items: dashboard.recentlyAdded },
    { label: 'Fast Selling', icon: <Zap size={13} />, items: dashboard.fastSelling },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <Package size={32} className="text-stitch-on-surface-variant/30" />
        <p className="text-sm text-stitch-on-surface-variant">No inventory yet</p>
        <p className="text-xs text-stitch-on-surface-variant/60">Add stock via Inventory → GRN</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {sections.map(({ label, icon, items }) => (
        <div key={label}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-stitch-on-surface-variant/60">{icon}</span>
            <h3 className="text-xs font-bold text-stitch-on-surface-variant uppercase tracking-wider">{label}</h3>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <ProductGrid products={items} loading={false} onAddToCart={onAddToCart} onViewUnits={onViewUnits} selectedCategory={null} />
        </div>
      ))}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: 'blue' | 'red' | 'green' | 'purple' | 'teal';
  loading: boolean;
}

function StatCard({ icon, label, value, accent, loading }: StatCardProps) {
  const accents: Record<StatCardProps['accent'], { ring: string; text: string; bg: string }> = {
    blue:   { ring: 'ring-sky-400/25',     text: 'text-sky-300',     bg: 'bg-sky-400/10' },
    red:    { ring: 'ring-rose-400/25',    text: 'text-rose-300',    bg: 'bg-rose-400/10' },
    green:  { ring: 'ring-emerald-400/25', text: 'text-emerald-300', bg: 'bg-emerald-400/10' },
    purple: { ring: 'ring-violet-400/25',  text: 'text-violet-300',  bg: 'bg-violet-400/10' },
    teal:   { ring: 'ring-teal-400/25',    text: 'text-teal-300',    bg: 'bg-teal-400/10' },
  };
  const a = accents[accent];
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 flex items-center gap-3 hover:bg-white/[0.04] transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ring-1 ${a.ring} ${a.bg} ${a.text}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider truncate">{label}</p>
        {loading ? (
          <div className="h-6 w-14 rounded bg-white/5 animate-pulse mt-0.5" />
        ) : (
          <p className="text-xl font-bold text-stitch-on-surface tabular-nums font-space leading-tight">{value.toLocaleString('en-PK')}</p>
        )}
      </div>
    </div>
  );
}

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Pill({ active, onClick, children }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-stitch-primary text-stitch-on-primary shadow-sm'
          : 'bg-white/[0.04] text-stitch-on-surface-variant hover:text-stitch-on-surface hover:bg-white/[0.07] border border-white/5'
      }`}
    >
      {children}
    </button>
  );
}

interface UnitPickerSheetProps {
  product: ProductCard;
  units: InventoryUnit[];
  loading: boolean;
  onClose: () => void;
  onAdd: (u: InventoryUnit) => void;
  cartSerials: string[];
}

function UnitPickerSheet({ product, units, loading, onClose, onAdd, cartSerials }: UnitPickerSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheetRef.current) return;
    gsap.fromTo(sheetRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div ref={sheetRef} onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-lg md:rounded-2xl rounded-t-2xl bg-stitch-surface-container border border-white/10 shadow-2xl flex flex-col max-h-[75vh]">
        <div className="px-5 py-4 border-b border-white/5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Select Serial Number</p>
            <h3 className="text-base font-bold text-stitch-on-surface font-space truncate">{product.name}</h3>
            <p className="text-xs text-stitch-on-surface-variant">{product.brand ?? '—'} · {formatPKR(product.sellingPrice)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-stitch-on-surface-variant hover:text-stitch-on-surface hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
          ) : units.length === 0 ? (
            <div className="py-10 text-center">
              <Package size={28} className="text-stitch-on-surface-variant/30 mx-auto mb-2" />
              <p className="text-sm text-stitch-on-surface-variant">No in-stock units available</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {units.map((u) => {
                const inCart = cartSerials.includes(u.serialNumber);
                return (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-stitch-tertiary truncate">{u.serialNumber}</p>
                      <p className="text-[11px] text-stitch-on-surface-variant">{u.condition ?? 'New'} Â· {formatPKR(u.sellingPrice ?? product.sellingPrice)}</p>
                    </div>
                    <button onClick={() => onAdd(u)} disabled={inCart}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stitch-primary text-stitch-on-primary text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Plus size={12} />{inCart ? 'Added' : 'Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
