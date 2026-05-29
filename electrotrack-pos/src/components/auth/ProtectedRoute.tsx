/**
 * ProtectedRoute — drop-in replacement for the custom RequireAuth component.
 *
 * The 4-phase auth check prevents the page-refresh redirect flicker:
 *   Phase 1: isReady=false → show spinner (auth not yet initialized)
 *   Phase 2: no session    → redirect to /login (preserving destination)
 *   Phase 3: role check    → redirect to role-appropriate fallback
 *   Phase 4: pass          → render <Outlet /> (children)
 *
 * Usage in App.tsx:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/pos" element={<PosScreen />} />
 *   </Route>
 *   <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/supabase-auth.store';

interface Props {
  allowedRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles, redirectTo = '/login' }: Props) {
  const { session, profile, isReady } = useAuthStore();
  const location = useLocation();

  // Phase 1 — Auth not yet initialised. AuthProvider's getSession() is async;
  // until it resolves, session is null and we must NOT redirect.
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0e1322]">
        <span className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Phase 2 — No valid session: send to login, preserve the intended path so
  // Login can redirect back after sign-in via location.state.from.
  if (!session) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Phase 3 — Role check (skipped if no allowedRoles provided).
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    const fallback =
      profile.role === 'platform_admin' ? '/tenants'
      : profile.role === 'owner' || profile.role === 'accountant' ? '/dashboard'
      : '/pos';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
