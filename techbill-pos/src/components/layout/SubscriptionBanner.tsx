import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useLicenseStore } from '../../store/license.store';

export const SubscriptionBanner: React.FC = () => {
  const { user } = useAuthStore();
  const { license } = useLicenseStore();

  if (!user || user.role === 'platform_admin' || !license) return null;

  const now = new Date();
  const expiresAt = license.expiresAt ? new Date(license.expiresAt) : null;
  const isInactive = license.status !== 'ACTIVE' && license.status !== 'TRIAL';
  
  let daysLeft = Infinity;
  if (expiresAt) {
    const diffMs = expiresAt.getTime() - now.getTime();
    daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  const isExpired = isInactive || license.isExpired;
  const isExpiringSoon = expiresAt !== null && daysLeft > 0 && daysLeft <= 2 && !isInactive && !license.isExpired;

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
