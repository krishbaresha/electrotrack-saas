import { useState, useEffect, useRef } from 'react';
import { Plus, ShoppingBag, X, Trash2, Search, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import gsap from 'gsap';
import { api } from '../../api/client';
import type { Product } from '../../types';

interface Supplier { id: string; name: string }
interface PoItem { productId: string; quantityOrdered: number; unitCostPrice: number }
interface PurchaseOrder {
  id: string;
  status: string;
  totalAmount: number | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  _count: { items: number };
  items?: { product: { name: string, brand: string | null }, quantityOrdered: number, unitCostPrice: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-white/5 text-stitch-on-surface-variant border border-white/10',
  sent:      'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  partial:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  received:  'bg-green-500/10 text-green-400 border border-green-500/20',
  cancelled: 'bg-stitch-error/10 text-stitch-error border border-stitch-error/20',
};

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/40';
const labelCls = 'block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1.5';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Expanded row state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Form state
  const [supplierInput, setSupplierInput] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PoItem[]>([{ productId: '', quantityOrdered: 1, unitCostPrice: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get<PurchaseOrder[]>('/purchase-orders');
      setOrders(res.data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    void api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data)).catch(() => undefined);
    void api
      .get<{ data: Product[] } | Product[]>('/inventory/products')
      .then((r) => {
        const d = r.data;
        setProducts(Array.isArray(d) ? d : (d as { data: Product[] }).data ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (containerRef.current && orders.length > 0) {
      const els = containerRef.current.querySelectorAll('.po-row');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [orders]);

  const q = search.toLowerCase();
  const filtered = orders.filter((po) =>
    !q ||
    po.id.toLowerCase().includes(q) ||
    (po.supplier?.name?.toLowerCase().includes(q) ?? false) ||
    po.status.includes(q),
  );

  const openCreate = () => {
    setSupplierInput('');
    setNotes('');
    setItems([{ productId: '', quantityOrdered: 1, unitCostPrice: 0 }]);
    setError(null);
    setShowForm(true);
  };

  const addItem = () =>
    setItems((prev) => [...prev, { productId: '', quantityOrdered: 1, unitCostPrice: 0 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<PoItem>) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  const totalAmount = items.reduce((s, i) => s + i.quantityOrdered * i.unitCostPrice, 0);

  const handleCreate = async () => {
    const validItems = items.filter((i) => i.productId);
    if (validItems.length === 0) { setError('Add at least one product'); return; }
    if (!supplierInput.trim()) { setError('Supplier name is required'); return; }
    
    setSaving(true);
    setError(null);

    // Determine if existing supplier or new
    const existingSupplier = suppliers.find(s => s.name.toLowerCase() === supplierInput.trim().toLowerCase());
    
    try {
      await api.post('/purchase-orders', {
        supplierId: existingSupplier ? existingSupplier.id : undefined,
        newSupplierName: !existingSupplier ? supplierInput.trim() : undefined,
        notes: notes || undefined,
        items: validItems.map(i => ({
          productId: i.productId,
          quantityOrdered: Number(i.quantityOrdered),
          unitCostPrice: Number(i.unitCostPrice)
        })),
      });
      setShowForm(false);
      void fetchOrders();
      // Refetch suppliers just in case we added a new one
      void api.get<Supplier[]>('/suppliers').then((r) => setSuppliers(r.data)).catch(() => undefined);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || err.message || 'Failed to create purchase order'));
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Mark this purchase order as received? The cost will be deducted from your gross profit.')) return;
    
    try {
      await api.patch(`/purchase-orders/${id}/receive`);
      void fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark as received');
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stitch-primary/10 flex items-center justify-center shrink-0">
            <ShoppingBag size={20} className="text-stitch-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stitch-on-surface font-space">Purchase Orders</h1>
            <p className="text-xs text-stitch-on-surface-variant">Manage supplier purchase orders</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus size={14} />
          New PO
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier, status…"
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/40"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">PO Ref</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider hidden sm:table-cell">Supplier</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider hidden md:table-cell">Items</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={8} className="text-center py-12 text-stitch-on-surface-variant">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-stitch-on-surface-variant">
                    {search ? 'No orders match your search' : 'No purchase orders yet'}
                  </td>
                </tr>
              )}
              {filtered.map((po) => (
                <React.Fragment key={po.id}>
                  <tr 
                    className="po-row hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => toggleRow(po.id)}
                  >
                    <td className="px-4 py-3">
                      <button className="text-stitch-on-surface-variant hover:text-white transition-colors">
                        {expandedRow === po.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={13} className="text-stitch-primary/60 shrink-0" />
                        <span className="font-mono text-xs text-stitch-on-surface">{po.id.slice(-8).toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-stitch-on-surface-variant hidden sm:table-cell">
                      {po.supplier?.name ?? <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-stitch-tertiary hidden md:table-cell">{po._count.items}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[po.status] ?? STATUS_COLORS.draft}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-stitch-on-surface-variant hidden lg:table-cell">
                      {format(new Date(po.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-stitch-on-surface">
                      {po.totalAmount != null ? `₨ ${Number(po.totalAmount).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {po.status !== 'received' && po.status !== 'cancelled' && (
                        <button
                          onClick={(e) => handleReceive(po.id, e)}
                          className="px-2.5 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-md text-[11px] font-bold transition-colors inline-flex items-center gap-1.5"
                          title="Mark as Received"
                        >
                          <CheckCircle size={12} />
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* Expanded Item Details */}
                  {expandedRow === po.id && po.items && (
                    <tr className="bg-black/20">
                      <td colSpan={8} className="p-4 border-b border-white/5">
                        <div className="pl-10 space-y-3">
                          <p className="text-xs font-bold text-stitch-on-surface-variant uppercase font-space tracking-wider">Line Items</p>
                          <div className="grid gap-2">
                            {po.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 max-w-2xl">
                                <div>
                                  <p className="text-sm text-white font-medium">{item.product.name}</p>
                                  {item.product.brand && <p className="text-[10px] text-stitch-on-surface-variant">{item.product.brand}</p>}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-mono text-stitch-primary">₨ {Number(item.unitCostPrice).toLocaleString()} <span className="text-stitch-on-surface-variant">× {item.quantityOrdered}</span></p>
                                  <p className="text-xs font-bold text-white mt-0.5">₨ {(Number(item.unitCostPrice) * item.quantityOrdered).toLocaleString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {po.notes && (
                            <div className="mt-4 max-w-2xl bg-white/5 p-3 rounded-lg border border-white/5">
                              <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1">Notes</p>
                              <p className="text-sm text-white/80">{po.notes}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="glass-modal rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h2 className="font-bold text-stitch-on-surface font-space">New Purchase Order</h2>
              <button onClick={() => setShowForm(false)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Supplier Name</label>
                  <input 
                    list="suppliers-list"
                    value={supplierInput} 
                    onChange={(e) => setSupplierInput(e.target.value)} 
                    className={inputCls} 
                    placeholder="Type to search or add new..." 
                    autoComplete="off"
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                  <p className="text-[10px] text-stitch-on-surface-variant mt-1.5">
                    If the name does not match an existing supplier, a new one will be created automatically.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Line Items</label>
                  <button onClick={addItem} className="text-xs text-stitch-primary hover:text-stitch-primary/80 flex items-center gap-1">
                    <Plus size={12} /> Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const p = products.find((x) => x.id === e.target.value);
                          updateItem(idx, { productId: e.target.value, unitCostPrice: p ? (Number(p.costPrice) || 0) : 0 });
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 min-w-0"
                      >
                        <option value="" className="bg-stitch-surface text-stitch-on-surface">Select product…</option>
                        {products.map((p) => <option key={p.id} value={p.id} className="bg-stitch-surface text-stitch-on-surface">{p.name}{p.brand ? ` (${p.brand})` : ''}</option>)}
                      </select>
                      <input
                        type="number" min={1} value={item.quantityOrdered}
                        onChange={(e) => updateItem(idx, { quantityOrdered: parseInt(e.target.value) || 1 })}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-center text-stitch-on-surface outline-none focus:border-stitch-primary/50"
                        placeholder="Qty"
                      />
                      <input
                        type="number" min={0} step={0.01} value={item.unitCostPrice}
                        onChange={(e) => updateItem(idx, { unitCostPrice: parseFloat(e.target.value) || 0 })}
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50"
                        placeholder="Cost"
                      />
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-stitch-on-surface-variant hover:text-stitch-error transition-colors shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end border-t border-white/5 pt-3">
                <p className="text-sm font-bold text-stitch-on-surface">
                  Total: <span className="text-stitch-primary font-mono">₨ {totalAmount.toLocaleString()}</span>
                </p>
              </div>

              {error && <p className="text-xs text-stitch-error">{error}</p>}
            </div>

            <div className="px-5 py-4 flex justify-end gap-2 shrink-0 border-t border-white/5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-stitch-on-surface-variant hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()} disabled={saving}
                className="px-4 py-2 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 disabled:opacity-50 active:scale-95 transition-all"
              >
                {saving ? 'Creating…' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
