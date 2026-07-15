import { Trash2, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../store/cart.store';

const formatPKR = (n: number) => `₨ ${n.toLocaleString('en-PK')}`;

export default function CartTable() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateItemPrice = useCartStore((s) => s.updateItemPrice);
  const isOnlineOrder = useCartStore((s) => s.isOnlineOrder);

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-xl h-full flex flex-col items-center justify-center gap-3">
        <ShoppingCart size={32} className="text-stitch-on-surface-variant/30" />
        <p className="text-sm text-stitch-on-surface-variant">Scan a serial number to add items</p>
      </div>
    );
  }

  const subtotal = items.reduce((s, i) => s + i.sellingPrice, 0);

  return (
    <div className="glass-card rounded-xl h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-stitch-surface-container-high/50 border-b border-white/5 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider w-8">#</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Serial</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider">Price</th>
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item, idx) => (
              <tr key={item.serialNumber} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5 text-stitch-on-surface-variant text-xs font-mono">{idx + 1}</td>
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-stitch-on-surface text-sm">{item.productName}</span>
                  {item.brand && (
                    <span className="text-stitch-on-surface-variant text-xs ml-1.5">{item.brand}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-stitch-tertiary">
                  {item.serialNumber}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-sm font-bold text-stitch-on-surface">
                  {isOnlineOrder ? (
                    <input
                      type="number"
                      className="w-24 bg-stitch-surface-container-high/50 border border-white/10 rounded px-2 py-1 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 text-right ml-auto"
                      value={item.sellingPrice}
                      onChange={(e) => updateItemPrice(item.serialNumber, Number(e.target.value) || 0)}
                    />
                  ) : (
                    formatPKR(item.sellingPrice)
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => removeItem(item.serialNumber)}
                    className="text-stitch-on-surface-variant hover:text-stitch-error transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/5 px-4 py-3 flex justify-between items-center shrink-0 bg-white/[0.02]">
        <span className="text-sm text-stitch-on-surface-variant">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        <span data-testid="cart-total" className="font-bold text-stitch-on-surface tabular-nums font-space">
          {formatPKR(subtotal)}
        </span>
      </div>
    </div>
  );
}
