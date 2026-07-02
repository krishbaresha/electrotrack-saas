import { Sparkles, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useDashboardStore } from '../../store/dashboard.store';

export default function AiInsights() {
  const data = useDashboardStore((s) => s.aiInsight);
  const fetchInsights = useDashboardStore((s) => s.fetchAiInsight);
  const isSyncing = useDashboardStore((s) => s.isSyncing); // We'll use this for the loading spinner

  const lines = data?.insight
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean) ?? [];

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-stitch-primary" />
          <p className="text-sm font-bold text-stitch-on-surface font-space">AI Insights</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <p className="text-[10px] text-stitch-on-surface-variant">
              {format(new Date(data.generatedAt), 'h:mm a')}
            </p>
          )}
          <button
            onClick={() => void fetchInsights()}
            disabled={isSyncing}
            className="text-stitch-on-surface-variant hover:text-white transition-colors disabled:opacity-40"
            title="Refresh insights"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {isSyncing && !data && (
          <div className="flex items-center gap-2 text-xs text-stitch-on-surface-variant py-2">
            <span className="w-3.5 h-3.5 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin shrink-0" />
            Generating insights…
          </div>
        )}

        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-stitch-on-surface leading-snug">
                <span className="w-1 h-1 rounded-full bg-stitch-primary mt-1.5 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
