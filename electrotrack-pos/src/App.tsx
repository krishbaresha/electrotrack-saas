import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { api } from './api/client';
import Login from './pages/Login';
import PosScreen from './pages/pos/PosScreen';
import OwnerDashboard from './pages/dashboard/OwnerDashboard';
import InventoryPage from './pages/inventory/InventoryPage';
import ReturnsPage from './pages/returns/ReturnsPage';
import ReturnAnalyticsPage from './pages/returns/ReturnAnalyticsPage';
import ReportsPage from './pages/reports/ReportsPage';
import CashReconciliationPage from './pages/reports/CashReconciliationPage';
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
import AppShell from './components/layout/AppShell';
import { can } from './lib/permissions';
import type { Role, Permission } from './types';

function RequireAuth({
  children,
  roles,
  permission,
}: {
  children: React.ReactElement;
  roles?: Role[];
  permission?: Permission;
}) {
  const { user, accessToken, isHydrating } = useAuthStore();
  // user restored from localStorage but token not yet refreshed — wait for App effect
  const pendingRefresh = !!user && !accessToken;
  if (isHydrating || pendingRefresh) {
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

export default function App() {
  const { user, accessToken, setToken, clearAuth, setHydrating } = useAuthStore();

  useEffect(() => {
    if (user && !accessToken) {
      setHydrating(true);
      api
        .post<{ access_token: string }>('/auth/refresh')
        .then(({ data }) => setToken(data.access_token))
        .catch(() => clearAuth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Root redirect logic
  const getRootRedirect = () => {
    if (!user) return '/login';
    if (user.role === 'platform_admin') return '/tenants';
    if (can('pos.read')) return '/pos';
    if (can('reports.read')) return '/dashboard';
    return '/pos';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to={getRootRedirect()} replace />} />
          
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
