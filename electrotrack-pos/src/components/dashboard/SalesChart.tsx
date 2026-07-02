import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useDashboardStore } from '../../store/dashboard.store';

export default function SalesChart() {
  const data = useDashboardStore((s) => s.chartData);

  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-sm font-bold text-stitch-on-surface font-space mb-4">Revenue — Last 7 Days</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Revenue']}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              background: 'rgba(20,20,35,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
            }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="revenue" fill="rgba(192,193,255,0.7)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
