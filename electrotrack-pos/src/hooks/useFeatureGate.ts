import { useAuthStore } from '../store/auth.store';

export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface PlanLimits {
  locations: number;
  staffUsers: number;
  analytics: 'basic' | 'full';
  billing: 'standard' | 'advanced' | 'custom';
  qrInvoices: boolean;
  offlineEngine?: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    locations: 1,
    staffUsers: 3,
    analytics: 'basic',
    billing: 'standard',
    qrInvoices: false,
  },
  pro: {
    locations: 3,
    staffUsers: Infinity,
    analytics: 'full',
    billing: 'advanced',
    qrInvoices: true,
  },
  enterprise: {
    locations: Infinity,
    staffUsers: Infinity,
    analytics: 'full',
    billing: 'custom',
    qrInvoices: true,
    offlineEngine: true,
  },
};

export function useFeatureGate() {
  const user = useAuthStore((s) => s.user);

  let currentPlan: PlanTier = 'starter';
  const rawPlan = (user?.currentPlan || 'starter').toLowerCase();

  if (rawPlan === 'enterprise') {
    currentPlan = 'enterprise';
  } else if (rawPlan === 'pro' || rawPlan === 'premium') {
    currentPlan = 'pro';
  } else {
    currentPlan = 'starter';
  }

  const limits = PLAN_LIMITS[currentPlan];

  return {
    plan: currentPlan,
    limits,
    isStarter: currentPlan === 'starter',
    isPro: currentPlan === 'pro',
    isEnterprise: currentPlan === 'enterprise',
  };
}
