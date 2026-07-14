import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Bell, ShieldAlert, Menu, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/auth.store';
import { useLockStore } from '../../store/lock.store';
import { disconnectSocket, socket } from '../../api/socket';
import { api } from '../../api/client';
import { getRootDomain, isMainDomain } from '../../lib/domain';
import { SubscriptionBanner } from './SubscriptionBanner';
import type { Notification } from '../../types';
import * as LucideIcons from 'lucide-react';
import { useLicenseStore } from '../../store/license.store';

export default function AppShell() {
  const { user, clearAuth } = useAuthStore();
  const { isPinSet, lock, setPin } = useLockStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [lockErrorMsg, setLockErrorMsg] = useState('');

  const handleLockClick = () => {
    if (isPinSet) {
      lock();
    } else {
      setShowSetPinModal(true);
    }
  };

  const handleSavePin = () => {
    if (newPin.length !== 4) {
      setLockErrorMsg('PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setLockErrorMsg('PINs do not match.');
      return;
    }
    setPin(newPin);
    setNewPin('');
    setConfirmPin('');
    setLockErrorMsg('');
    setShowSetPinModal(false);
    setTimeout(() => {
      lock();
    }, 100);
  };

  const isPlatformAdmin = user?.role === 'platform_admin';

  const { license, fetchLicense } = useLicenseStore();

  useEffect(() => {
    // Only fetch for non-platform admin users, or if user is loaded
    if (user) {
      void fetchLicense();
    }
  }, [user, fetchLicense]);

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

  const standardNavItems = license?.navigation.filter(
    (n) => n.category !== 'Administration' && n.category !== 'Settings'
  ) || [];

  const configNavItems = license?.navigation.filter(
    (n) => n.category === 'Administration' || n.category === 'Settings'
  ) || [];


  const fetchNotifications = useCallback(async () => {
    if (isPlatformAdmin) return;
    try {
      const res = await api.get<{ notifications: Notification[] }>('/notifications');
      setNotifications(res.data.notifications ?? []);
    } catch {
      // silently ignore — bell is non-critical
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (isPlatformAdmin) return;
    void fetchNotifications();
    const interval = setInterval(() => { void fetchNotifications(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isPlatformAdmin]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (n: Notification) => {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      );
    }
    if (n.actionUrl) {
      setBellOpen(false);
      navigate(n.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = async () => {
    disconnectSocket();
    
    // 1. Attempt to revoke the refresh token on the backend
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Silently ignore backend errors; proceed with frontend cleanup
      // (The token is still revoked server-side, and we'll clear locally)
    }
    
    // 2. Clear local auth state immediately
    clearAuth();
    
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    
    // 3. If user is on a tenant subdomain, redirect to main domain with logout flag
    if (!isMainDomain(hostname)) {
      const protocol = isLocalhost ? 'http:' : 'https:';
      const rootDomain = getRootDomain(hostname);
      // Hard redirect (window.location.href) triggers a full page load,
      // which re-runs main.tsx's circuit-breaker BEFORE React initialization
      window.location.href = `${protocol}//${rootDomain}/login?logout=true`;
      // Return early to prevent any further code execution
      return;
    }
    
    // 4. If already on the main domain, trigger the circuit-breaker by navigating with logout flag
    // Then redirect to login page (which will load clean due to circuit-breaker)
    window.location.href = `${window.location.protocol}//${window.location.host}/login?logout=true`;
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
      isActive
        ? 'bg-white/10 text-stitch-primary border border-white/10 font-space shadow-sm'
        : 'text-stitch-on-surface-variant hover:bg-white/5 hover:text-white'
    }`;

  const platformNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
      isActive
        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-space shadow-sm'
        : 'text-stitch-on-surface-variant hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-stitch-surface text-stitch-on-surface overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-56 glass-panel flex flex-col shrink-0
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img src="/favicon.svg" alt="TechBill Icon" className="w-6 h-6 object-contain shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-sm tracking-tight font-space truncate">
                {isPlatformAdmin ? 'SaaS Admin Console' : user?.tenantName || 'TechBill'}
              </p>
              <p className="text-[10px] text-stitch-on-surface-variant mt-0.5 truncate font-semibold uppercase tracking-wider font-mono">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          {!isPlatformAdmin && (
            <div ref={bellRef} className="relative ml-2">
              <button
                onClick={() => setBellOpen((o) => !o)}
                className="relative p-1.5 rounded-lg text-stitch-on-surface-variant hover:bg-white/5 hover:text-white transition-colors"
                aria-label="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-stitch-error text-stitch-on-error text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="fixed top-16 left-2 right-2 sm:left-auto sm:right-4 sm:w-80 lg:left-56 lg:right-auto glass-modal rounded-xl z-50 flex flex-col max-h-80 shadow-2xl overflow-hidden animate-fade-in border border-white/10">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 bg-white/5">
                    <span className="text-xs font-bold text-stitch-primary font-space">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-stitch-tertiary hover:text-stitch-tertiary/80 transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-white/5">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-stitch-on-surface-variant text-center py-8 font-medium">No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleMarkRead(n)}
                          className={`w-full text-left px-3.5 py-3 hover:bg-white/5 transition-all ${
                            !n.isRead ? 'bg-white/[0.02]' : ''
                          }`}
                        >
                          <p className={`text-xs font-bold font-space ${!n.isRead ? 'text-white' : 'text-stitch-on-surface-variant'}`}>
                            {n.type ?? 'Notification'}
                          </p>
                          <p className="text-[11px] text-stitch-on-surface-variant mt-1 leading-relaxed">{n.message}</p>
                          <p className="text-[9px] text-stitch-on-surface-variant/60 mt-1.5 font-mono">
                            {format(new Date(n.createdAt), 'dd MMM, h:mm a')}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto" onClick={() => setSidebarOpen(false)}>
          {/* Platform Admin Sidebar section */}
          {isPlatformAdmin && (
            <NavLink to="/tenants" className={platformNavClass}>
              <ShieldAlert size={16} />
              Tenant Shops
            </NavLink>
          )}

          {/* Standard Shop Sidebar sections */}
          {standardNavItems.map((item) => {
            const IconComp = (LucideIcons[item.icon as keyof typeof LucideIcons] || LucideIcons.Package) as React.ComponentType<{ size: number }>;
            return (
              <NavLink key={item.key} to={item.route} className={navClass}>
                <IconComp size={16} />
                {item.title}
              </NavLink>
            );
          })}

          {configNavItems.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider font-space">Configuration</p>
              </div>
              {configNavItems.map((item) => {
                const IconComp = (LucideIcons[item.icon as keyof typeof LucideIcons] || LucideIcons.Package) as React.ComponentType<{ size: number }>;
                return (
                  <NavLink key={item.key} to={item.route} className={navClass}>
                    <IconComp size={16} />
                    {item.title}
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-2 border-t border-white/5 shrink-0 bg-white/[0.01] space-y-1">
          {!isPlatformAdmin && (
            <button
              onClick={handleLockClick}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-stitch-on-surface-variant hover:bg-white/5 hover:text-white transition-all font-semibold"
            >
              <Lock size={16} />
              Lock App
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-stitch-on-surface-variant hover:bg-white/5 hover:text-white transition-all font-semibold"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gradient-to-tr from-[#0e1322] via-[#11172a] to-[#1e1a38] relative flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-stitch-on-surface-variant hover:bg-white/5 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <p className="font-bold text-white text-sm font-space truncate">
            {isPlatformAdmin ? 'SaaS Admin Console' : user?.tenantName || 'TechBill'}
          </p>
        </div>
        <div className="flex-1 overflow-auto">
          <SubscriptionBanner />
          <Outlet />
        </div>
      </main>

      {showSetPinModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="glass-modal w-full max-w-sm rounded-xl p-6 border border-white/10 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white font-space mb-2 flex items-center gap-1.5">
              <Lock className="text-stitch-primary" size={18} /> Set App Lock PIN
            </h3>
            <p className="text-xs text-stitch-on-surface-variant leading-relaxed mb-4">
              Create a 4-digit PIN to secure your application when you step away.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1">
                  Choose PIN (4 digits)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewPin(val);
                    setLockErrorMsg('');
                  }}
                  className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50 text-center tracking-widest text-lg font-bold"
                  placeholder="••••"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setConfirmPin(val);
                    setLockErrorMsg('');
                  }}
                  className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50 text-center tracking-widest text-lg font-bold"
                  placeholder="••••"
                />
              </div>

              {lockErrorMsg && (
                <div className="flex gap-2 bg-stitch-error/10 border border-stitch-error/20 p-2.5 rounded-lg text-xs text-stitch-error items-center leading-normal">
                  <p>{lockErrorMsg}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSetPinModal(false);
                    setNewPin('');
                    setConfirmPin('');
                    setLockErrorMsg('');
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-stitch-on-surface-variant hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-stitch-primary text-white hover:bg-stitch-primary/80 transition-colors"
                >
                  Save & Lock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
