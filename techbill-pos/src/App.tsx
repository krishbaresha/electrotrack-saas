import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { api } from './api/client';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import PublicLayout from './components/layout/PublicLayout';
import PrivacyPolicy from './pages/public/PrivacyPolicy';
import TermsOfService from './pages/public/TermsOfService';
import Security from './pages/public/Security';
import CheckoutPage from './pages/public/CheckoutPage';
import ReturnPolicy from './pages/public/ReturnPolicy';
import ShippingPolicy from './pages/public/ShippingPolicy';
import PosScreen from './pages/pos/PosScreen';
import OwnerDashboard from './pages/dashboard/OwnerDashboard';
import InventoryPage from './pages/inventory/InventoryPage';
import ReturnsPage from './pages/returns/ReturnsPage';
import ReturnAnalyticsPage from './pages/returns/ReturnAnalyticsPage';
import ReportsPage from './pages/reports/ReportsPage';
import CashReconciliationPage from './pages/reports/CashReconciliationPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import UsersPage from './pages/users/UsersPage';
import SettingsPage from './pages/settings/SettingsPage';
import AuditPage from './pages/audit/AuditPage';
import CustomersPage from './pages/customers/CustomersPage';
import LoyaltyPage from './pages/customers/LoyaltyPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import PurchaseOrdersPage from './pages/suppliers/PurchaseOrdersPage';
import GrnPage from './pages/suppliers/GrnPage';
import WarrantyPage from './pages/warranty/WarrantyPage';
import TenantsPage from './pages/tenants/TenantsPage';
import InvoiceHistoryPage from './pages/sales/InvoiceHistoryPage';
import PublicInvoicePage from './pages/sales/PublicInvoicePage';
import OnlineOrdersPage from './pages/sales/OnlineOrdersPage';
import AppShell from './components/layout/AppShell';
import { can } from './lib/permissions';
import type { Role, Permission } from './types';
import LockOverlay from './components/auth/LockOverlay';
import { useLockStore } from './store/lock.store';
import ToastContainer from './components/common/ToastContainer';

function RequireAuth({
  children,
  roles,
  permission,
}: {
  children: React.ReactElement;
  roles?: Role[];
  permission?: Permission;
}) {
  const { user, accessToken, isHydrating, _hasHydrated } = useAuthStore();
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
  if (!accessToken || !user) return <Navigate to="/login" replace />;

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

// Guard against React StrictMode double-invocation in dev.
// Without this, both calls hit /auth/refresh with the same cookie:
//   Call 1 → revokes token A, creates token B → success
//   Call 2 → token A already revoked → 401 → clearAuth() → forced logout
let isRefreshingInProgress = false;

export default function App() {
  const { user, accessToken, refreshToken, setToken, setAuth, clearAuth, setHydrating, isHydrating, _hasHydrated } = useAuthStore();

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

  // Auto-lock inactivity handler
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
                <PosScreen />
              </RequireAuth>
            }
          />
          <Route
            path="dashboard"
            element={
              <RequireAuth permission="reports.read">
                <OwnerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="inventory"
            element={
              <RequireAuth permission="inventory.read">
                <InventoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="returns"
            element={
              <RequireAuth permission="returns.read">
                <ReturnsPage />
              </RequireAuth>
            }
          />
          <Route
            path="reports"
            element={
              <RequireAuth permission="reports.read">
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path="users"
            element={
              <RequireAuth permission="users.read">
                <UsersPage />
              </RequireAuth>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAuth permission="settings.read">
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="audit"
            element={
              <RequireAuth permission="audit.read">
                <AuditPage />
              </RequireAuth>
            }
          />
          <Route
            path="customers"
            element={
              <RequireAuth permission="customers.read">
                <CustomersPage />
              </RequireAuth>
            }
          />
          <Route
            path="suppliers"
            element={
              <RequireAuth permission="suppliers.read">
                <SuppliersPage />
              </RequireAuth>
            }
          />
          <Route
            path="purchase-orders"
            element={
              <RequireAuth permission="suppliers.read">
                <PurchaseOrdersPage />
              </RequireAuth>
            }
          />
          <Route
            path="grn"
            element={
              <RequireAuth permission="suppliers.write">
                <GrnPage />
              </RequireAuth>
            }
          />
          <Route
            path="warranty"
            element={
              <RequireAuth permission="warranty.read">
                <WarrantyPage />
              </RequireAuth>
            }
          />
          <Route
            path="loyalty"
            element={
              <RequireAuth permission="loyalty.read">
                <LoyaltyPage />
              </RequireAuth>
            }
          />
          <Route
            path="return-analytics"
            element={
              <RequireAuth permission="returns.read">
                <ReturnAnalyticsPage />
              </RequireAuth>
            }
          />
          <Route
            path="cash-reconciliation"
            element={
              <RequireAuth permission="reports.cash_reconciliation">
                <CashReconciliationPage />
              </RequireAuth>
            }
          />
          <Route
            path="expenses"
            element={
              <RequireAuth permission="reports.read">
                <ExpensesPage />
              </RequireAuth>
            }
          />
          {/* Owner-only: full invoice management */}
          <Route
            path="invoices"
            element={
              <RequireAuth roles={['owner']}>
                <InvoiceHistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="online-orders"
            element={
              <RequireAuth permission="pos.online_sell">
                <OnlineOrdersPage />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
