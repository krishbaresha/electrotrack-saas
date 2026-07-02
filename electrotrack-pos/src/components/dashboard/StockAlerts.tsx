import { useEffect } from 'react';
import { socket } from '../../api/socket';
import { useDashboardStore } from '../../store/dashboard.store';
import type { WsStockLowPayload } from '../../types';

export default function StockAlerts() {
  const alerts = useDashboardStore((s) => s.lowStock);
  const updateLowStockFromWs = useDashboardStore((s) => s.updateLowStockFromWs);

  useEffect(() => {
    const handler = (data: WsStockLowPayload) => {
      updateLowStockFromWs(data);
    };

    socket.on('stock.low', handler);
    return () => {
      socket.off('stock.low', handler);
    };
  }, [updateLowStockFromWs]);

  if (alerts.length === 0) return null;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-sm font-bold text-amber-400 font-space">Low Stock Alerts</p>
      </div>
      <div className="divide-y divide-white/5 max-h-52 overflow-auto">
        {alerts.map((item) => (
          <div key={item.productId} className="px-4 py-2.5 flex justify-between items-center hover:bg-white/[0.03] transition-colors">
            <p className="text-sm text-stitch-on-surface truncate flex-1 mr-2">{item.productName}</p>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                item.inStockCount === 0
                  ? 'bg-stitch-error/10 text-stitch-error border border-stitch-error/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {item.inStockCount} left
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
