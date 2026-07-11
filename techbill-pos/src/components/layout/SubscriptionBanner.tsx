import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

export const SubscriptionBanner: React.FC = () => {
  const { user } = useAuthStore();

  if (!user || user.role === 'platform_admin') return null;

  const now = new Date();
  const periodEnd = user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null;
  const isInactive = user.tenantStatus !== undefined && user.tenantStatus !== 'active';
  
  let daysLeft = Infinity;
  if (periodEnd) {
    const diffMs = periodEnd.getTime() - now.getTime();
    daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  const isExpired = daysLeft <= 0 || isInactive;
  const isExpiringSoon = daysLeft > 0 && daysLeft <= 2 && !isInactive;

  if (!isExpired && !isExpiringSoon) return null;

  return (
    <div className={`px-4 py-2.5 flex items-center gap-2.5 text-sm font-semibold shrink-0 ${
      isExpired
        ? 'bg-red-500/15 border-b border-red-500/30 text-red-400'
        : 'bg-amber-500/15 border-b border-amber-500/30 text-amber-400'
    }`}>
      <AlertTriangle size={16} className="shrink-0" />
      {isExpired
        ? "Your store's subscription is currently inactive. All new transactions are disabled. Please contact the platform admin to renew."
        : `Your subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please contact the platform admin to renew.`}
    </div>
  );
};
