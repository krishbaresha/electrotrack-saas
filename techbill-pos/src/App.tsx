import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { api } from './api/client';
import { getRootDomain } from './lib/domain';

const Login = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PrivacyPolicy = lazy(() => import('./pages/public/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/public/TermsOfService'));
const Security = lazy(() => import('./pages/public/Security'));
const CheckoutPage = lazy(() => import('./pages/public/CheckoutPage'));
const ReturnPolicy = lazy(() => import('./pages/public/ReturnPolicy'));
const ShippingPolicy = lazy(() => import('./pages/public/ShippingPolicy'));
const PosScreen = lazy(() => import('./pages/pos/PosScreen'));
const OwnerDashboard = lazy(() => import('./pages/dashboard/OwnerDashboard'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
const ReturnsPage = lazy(() => import('./pages/returns/ReturnsPage'));
const ReturnAnalyticsPage = lazy(() => import('./pages/returns/ReturnAnalyticsPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const CashReconciliationPage = lazy(() => import('./pages/reports/CashReconciliationPage'));
const ExpensesPage = lazy(() => import('./pages/expenses/ExpensesPage'));
const CreditPage = lazy(() => import('./pages/credit/CreditPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AuditPage = lazy(() => import('./pages/audit/AuditPage'));
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'));
const LoyaltyPage = lazy(() => import('./pages/customers/LoyaltyPage'));
const SuppliersPage = lazy(() => import('./pages/suppliers/SuppliersPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/suppliers/PurchaseOrdersPage'));
const WarrantyPage = lazy(() => import('./pages/warranty/WarrantyPage'));
const TenantsPage = lazy(() => import('./pages/tenants/TenantsPage'));
const InvoiceHistoryPage = lazy(() => import('./pages/sales/InvoiceHistoryPage'));
const PublicInvoicePage = lazy(() => import('./pages/sales/PublicInvoicePage'));
const OnlineOrdersPage = lazy(() => import('./pages/sales/OnlineOrdersPage'));

import PublicLayout from './components/layout/PublicLayout';
import AppShell from './components/layout/AppShell';
import { can } from './lib/permissions';
import type { Role, Permission } from './types';
import LockOverlay from './components/auth/LockOverlay';
import { useLockStore } from './store/lock.store';
import ToastContainer from './components/common/ToastContainer';
import { useLicenseStore } from './store/license.store';
import { socket } from './api/socket';


function RequireAuth({
  children,
  roles,
  permission,
}: {
  children: React.ReactElement;
  roles?: Role[];
  permission?: Permission;
}) {
  const { user, accessToken, refreshToken, isHydrating, _hasHydrated } = useAuthStore();
  // user restored from localStorage but token not yet refreshed — wait for App effect
  const pendingRefresh = !!user && !accessToken;
  const hasUrlAuth = new URLSearchParams(window.location.search).has('token');

  if (!_hasHydrated || isHydrating || pendingRefresh || hasUrlAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="w-8 h-8 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  // Subdomain enforcement for logged-in users
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost && user.role !== 'platform_admin') {
    if (!user.subdomain) {
      // Legacy session without subdomain claim: force logout so they re-authenticate and get a valid token payload
      useAuthStore.getState().clearAuth();
      const root = getRootDomain();
      const protocol = root.includes('localhost') ? 'http:' : 'https:';
      window.location.href = `${protocol}//${root}/login?logout=true`;
      return null;
    }
    if (window.location.hostname !== `${user.subdomain}.${getRootDomain()}`) {
      const u = encodeURIComponent(btoa(JSON.stringify(user)));
      const qs = `?token=${accessToken}&refresh_token=${refreshToken || ''}&u=${u}`;
      const root = getRootDomain();
      const protocol = root.includes('localhost') ? 'http:' : 'https:';
      window.location.href = `${protocol}//${user.subdomain}.${root}${window.location.pathname}${qs}`;
      return null;
    }
  }

  // Platform Admin enforcement
  if (!isLocalhost && user.role === 'platform_admin') {
    if (window.location.hostname !== `admin.${getRootDomain()}`) {
      const u = encodeURIComponent(btoa(JSON.stringify(user)));
      const qs = `?token=${accessToken}&refresh_token=${refreshToken || ''}&u=${u}`;
      const root = getRootDomain();
      const protocol = root.includes('localhost') ? 'http:' : 'https:';
      window.location.href = `${protocol}//admin.${root}${window.location.pathname}${qs}`;
      return null;
    }
  }

  // Broad roles bypass / check
  if (roles && !roles.includes(user.role)) {
    const fallback =
      user.role === 'platform_admin'
        ? '/tenants'
        : user.role === 'owner' || user.role === 'accountant'
        ? '/dashboard'
        : '/pos';
    return <Navigate to={fallback} replace />;
  }

  // Granular permission check
  if (permission && !can(permission)) {
    const fallback =
      user.role === 'platform_admin'
        ? '/tenants'
        : user.role === 'owner' || user.role === 'accountant'
        ? '/dashboard'
        : '/pos';
    return <Navigate to={fallback} replace />;
  }

  return children;
}

function RequireFeature({
  children,
  feature,
  requiredAccess = 'READ',
}: {
  children: React.ReactElement;
  feature: string;
  requiredAccess?: 'NONE' | 'READ' | 'WRITE' | 'FULL';
}) {
  const { user } = useAuthStore();
  const { hasFeatureAccess, isLoading, license } = useLicenseStore();

  if (user?.role === 'platform_admin') {
    return children;
  }

  if (isLoading || !license) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stitch-surface">
        <span className="w-8 h-8 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasFeatureAccess(feature, requiredAccess)) {
    return <Navigate to="/feature-disabled" replace />;
  }

  return children;
}

const FeatureDisabledPage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-stitch-surface text-stitch-on-surface p-4">
    <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border border-white/10 shadow-2xl space-y-6">
      <div className="mx-auto w-16 h-16 bg-stitch-error/10 text-stitch-error rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight font-space text-white">Feature Disabled</h2>
        <p className="text-sm text-stitch-on-surface-variant leading-relaxed">
          This capability is not enabled under your current subscription plan. Please contact your administrator to upgrade.
        </p>
      </div>
      <button
        onClick={() => window.location.href = '/dashboard'}
        className="w-full py-2.5 px-4 rounded-xl bg-stitch-primary hover:bg-stitch-primary/90 text-stitch-on-primary font-semibold text-sm transition-all duration-200"
      >
        Go to Dashboard
      </button>
    </div>
  </div>
);

// Guard against React StrictMode double-invocation in dev.
// Without this, both calls hit /auth/refresh with the same cookie:
//   Call 1 → revokes token A, creates token B → success
//   Call 2 → token A already revoked → 401 → clearAuth() → forced logout
let isRefreshingInProgress = false;

export default function App() {
  const { user, accessToken, refreshToken, setToken, setAuth, clearAuth, setHydrating, isHydrating, _hasHydrated } = useAuthStore();

  const { fetchLicense } = useLicenseStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenUrl = params.get('token');
    const refreshUrl = params.get('refresh_token');
    const uUrl = params.get('u');

    if (tokenUrl && uUrl) {
      try {
        const decodedUser = JSON.parse(atob(decodeURIComponent(uUrl)));
        setAuth(decodedUser, tokenUrl, refreshUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse user from URL', e);
      }
    }
  }, [setAuth]);

  useEffect(() => {
    if (user && accessToken) {
      void fetchLicense();
    }
  }, [user, accessToken, fetchLicense]);

  useEffect(() => {
    const handleUpdate = (payload: { tenantId: string }) => {
      if (payload.tenantId === '*' || payload.tenantId === user?.tenantId) {
        void fetchLicense();
      }
    };

    socket.on('subscription.updated', handleUpdate);
    socket.on('features.updated', handleUpdate);
    socket.on('license.updated', handleUpdate);
    socket.on('tenant.updated', handleUpdate);

    return () => {
      socket.off('subscription.updated', handleUpdate);
      socket.off('features.updated', handleUpdate);
      socket.off('license.updated', handleUpdate);
      socket.off('tenant.updated', handleUpdate);
    };
  }, [user?.tenantId, fetchLicense]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (isHydrating) return;
    if (!user) return;
    if (accessToken) return;

    if (isRefreshingInProgress) return;
    isRefreshingInProgress = true;

    setHydrating(true);
    api
      .post<{ access_token: string; refresh_token?: string }>(
        '/auth/refresh',
        { refresh_token: refreshToken },
        { timeout: 10_000 }
      )
      .then(({ data }) => setToken(data.access_token, data.refresh_token || refreshToken))
      .catch(() => clearAuth())
      .finally(() => {
        isRefreshingInProgress = false;
      });
  }, [_hasHydrated, isHydrating, user, accessToken, refreshToken, setToken, clearAuth, setHydrating]);

  // Eager background preload for critical routes after authentication
  useEffect(() => {
    if (user && accessToken) {
      const preloadTimer = setTimeout(() => {
        // Preload core operational screens silently
        import('./pages/dashboard/OwnerDashboard');
        import('./pages/pos/PosScreen');
        import('./pages/inventory/InventoryPage');
        import('./pages/sales/InvoiceHistoryPage');
        import('./pages/settings/SettingsPage');
      }, 1000); // 1 second after initial render
      return () => clearTimeout(preloadTimer);
    }
  }, [user, accessToken]);
  const { isLocked, isPinSet, lock, autoLockMinutes } = useLockStore();

  useEffect(() => {
    if (!isPinSet || autoLockMinutes <= 0 || isLocked) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        lock();
      }, autoLockMinutes * 60 * 1000);
    };

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isPinSet, autoLockMinutes, isLocked, lock]);


  return (
    <BrowserRouter>
      <LockOverlay />
      <ToastContainer />
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-stitch-surface">
          <span className="w-8 h-8 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
        </div>
      }>
        <Routes>
          {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/security" element={<Security />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/return-policy" element={<ReturnPolicy />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
        </Route>
        <Route path="/login" element={<Login />} />
        {/* Public unauthenticated route for QR code invoice verification */}
        <Route path="/public/invoice/:id" element={<PublicInvoicePage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          
          {/* Platform Admin Route */}
          <Route
            path="tenants"
            element={
              <RequireAuth roles={['platform_admin']}>
                <TenantsPage />
              </RequireAuth>
            }
          />

          {/* Tenant Business Routes */}
          <Route
            path="pos"
            element={
              <RequireAuth permission="pos.read">
                <RequireFeature feature="pos">
                  <PosScreen />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="dashboard"
            element={
              <RequireAuth permission="reports.read">
                <RequireFeature feature="dashboard">
                  <OwnerDashboard />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="inventory"
            element={
              <RequireAuth permission="inventory.read">
                <RequireFeature feature="inventory">
                  <InventoryPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="returns"
            element={
              <RequireAuth permission="returns.read">
                <RequireFeature feature="returns">
                  <ReturnsPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="reports"
            element={
              <RequireAuth permission="reports.read">
                <RequireFeature feature="reports">
                  <ReportsPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="users"
            element={
              <RequireAuth permission="users.read">
                <RequireFeature feature="users_staff">
                  <UsersPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAuth permission="settings.read">
                <RequireFeature feature="shop_settings">
                  <SettingsPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="audit"
            element={
              <RequireAuth permission="audit.read">
                <RequireFeature feature="audit_logs">
                  <AuditPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="customers"
            element={
              <RequireAuth permission="customers.read">
                <RequireFeature feature="customers">
                  <CustomersPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="suppliers"
            element={
              <RequireAuth permission="suppliers.read">
                <RequireFeature feature="suppliers">
                  <SuppliersPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="purchase-orders"
            element={
              <RequireAuth permission="suppliers.read">
                <RequireFeature feature="purchase_orders">
                  <PurchaseOrdersPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="warranty"
            element={
              <RequireAuth permission="warranty.read">
                <RequireFeature feature="warranty">
                  <WarrantyPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="loyalty"
            element={
              <RequireAuth permission="loyalty.read">
                <RequireFeature feature="loyalty_rewards">
                  <LoyaltyPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="return-analytics"
            element={
              <RequireAuth permission="returns.read">
                <RequireFeature feature="return_analytics">
                  <ReturnAnalyticsPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="cash-reconciliation"
            element={
              <RequireAuth permission="reports.cash_reconciliation">
                <RequireFeature feature="cash_reconciliation">
                  <CashReconciliationPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="expenses"
            element={
              <RequireAuth permission="reports.read">
                <RequireFeature feature="expenses">
                  <ExpensesPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="credit"
            element={
              <RequireAuth permission="reports.read">
                <RequireFeature feature="credit">
                  <CreditPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          {/* Owner-only: full invoice management */}
          <Route
            path="invoices"
            element={
              <RequireAuth permission="invoices.read">
                <RequireFeature feature="invoices">
                  <InvoiceHistoryPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
          <Route
            path="online-orders"
            element={
              <RequireAuth permission="pos.online_sell">
                <RequireFeature feature="online_orders">
                  <OnlineOrdersPage />
                </RequireFeature>
              </RequireAuth>
            }
          />
        </Route>
        <Route path="/feature-disabled" element={<FeatureDisabledPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
