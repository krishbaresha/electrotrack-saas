import { useEffect, useRef, useState } from 'react';
import { Plus, UserX, UserCheck, RefreshCw, Key, Shield, Edit, X, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useCan } from '../../lib/permissions';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import type { StaffUser, Role, Permission } from '../../types';
import gsap from 'gsap';

const ROLES: Role[] = ['owner', 'cashier', 'inventory_manager', 'accountant', 'technician'];

const ROLE_COLORS: Record<Role, string> = {
  platform_admin: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  owner:          'bg-stitch-primary/10 text-stitch-primary border-stitch-primary/20',
  cashier:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
  inventory_manager: 'bg-green-500/10 text-green-400 border-green-500/20',
  accountant:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  technician:     'bg-white/5 text-stitch-on-surface-variant border-white/10',
};

const ALL_POSSIBLE_PERMISSIONS: { key: Permission; label: string; desc: string }[] = [
  { key: 'pos.read', label: 'Access POS Screen', desc: 'Can view and open POS selling screen.' },
  { key: 'pos.sell', label: 'Process Sales', desc: 'Can checkout and record new sales.' },
  { key: 'pos.discount', label: 'Apply Discounts', desc: 'Can apply manual product or cart discounts.' },
  { key: 'pos.void', label: 'Void Transactions', desc: 'Can cancel or void sales.' },
  { key: 'pos.online_sell', label: 'Online Selling', desc: 'Can process online orders with advance/COD.' },
  { key: 'inventory.read', label: 'View Inventory', desc: 'Can search and view products/stock.' },
  { key: 'inventory.write', label: 'Modify Inventory', desc: 'Can add, edit, and receive inventory units.' },
  { key: 'inventory.delete', label: 'Delete Inventory', desc: 'Can deactivate/delete inventory products.' },
  { key: 'suppliers.read', label: 'View Suppliers', desc: 'Can view suppliers and purchase orders.' },
  { key: 'suppliers.write', label: 'Manage Suppliers', desc: 'Can create/edit suppliers and process POs.' },
  { key: 'customers.read', label: 'View Customers', desc: 'Can browse customer directory.' },
  { key: 'customers.write', label: 'Manage Customers', desc: 'Can create or edit customer details.' },
  { key: 'returns.read', label: 'View Returns', desc: 'Can view return logs.' },
  { key: 'returns.create', label: 'Initiate Returns', desc: 'Can request return or refund items.' },
  { key: 'returns.review', label: 'Approve Returns', desc: 'Can approve/reject return requests.' },
  { key: 'reports.read', label: 'View Analytics', desc: 'Can see standard reports and dashboards.' },
  { key: 'reports.cash_reconciliation', label: 'Cash Reconciliation', desc: 'Can submit or review till reconciliations.' },
  { key: 'users.read', label: 'View Users', desc: 'Can view list of store users.' },
  { key: 'users.manage', label: 'Manage Users', desc: 'Can create, activate/deactivate, and reset workers.' },
  { key: 'users.permissions', label: 'Assign Permissions', desc: 'Can edit worker permission checkboxes.' },
  { key: 'settings.read', label: 'View Settings', desc: 'Can access shop configurations.' },
  { key: 'settings.manage', label: 'Manage Settings', desc: 'Can update shop configurations.' },
  { key: 'audit.read', label: 'View Audit Logs', desc: 'Can browse store change histories.' },
  { key: 'notifications.read', label: 'Read Notifications', desc: 'Can receive in-app alerts.' },
  { key: 'notifications.manage', label: 'Manage Notifications', desc: 'Can mark alerts as read/cleared.' },
  { key: 'warranty.read', label: 'Check Warranties', desc: 'Can search items by serial key for warranty status.' },
  { key: 'loyalty.read', label: 'View Loyalty', desc: 'Can read customer loyalty details.' },
  { key: 'loyalty.manage', label: 'Manage Loyalty', desc: 'Can modify loyalty rules or points.' },
];

const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  platform_admin: [],
  owner: [],
  cashier: ['pos.read', 'pos.sell', 'customers.read', 'customers.write', 'returns.read', 'returns.create', 'notifications.read', 'warranty.read'],
  inventory_manager: ['pos.read', 'inventory.read', 'inventory.write', 'suppliers.read', 'suppliers.write', 'notifications.read', 'warranty.read'],
  accountant: ['reports.read', 'reports.cash_reconciliation', 'customers.read', 'notifications.read', 'audit.read'],
  technician: ['inventory.read', 'warranty.read', 'returns.read', 'notifications.read'],
};

interface FormState {
  name: string;
  email: string;
  password?: string;
  role: Role;
  permissions: Permission[];
}

const inputCls = 'w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50';
const selectCls = `${inputCls} capitalize`;
const labelCls = 'block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1';

interface PermissionGridProps {
  permissions: Permission[];
  canAssign: boolean;
  onToggle: (p: Permission) => void;
}

function PermissionGrid({ permissions, canAssign, onToggle }: PermissionGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {ALL_POSSIBLE_PERMISSIONS.map(({ key, label, desc }) => {
        const isChecked = permissions.includes(key);
        return (
          <label
            key={key}
            className={`flex gap-2 items-start p-2.5 border rounded-lg transition-all ${
              isChecked
                ? 'border-stitch-primary/30 bg-stitch-primary/5'
                : 'border-white/5 hover:bg-white/5'
            } ${!canAssign ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={!canAssign}
              onChange={() => onToggle(key)}
              className="mt-0.5 accent-[#c0c1ff] shrink-0"
            />
            <div>
              <p className="text-xs font-semibold text-stitch-on-surface leading-tight">{label}</p>
              <p className="text-[10px] text-stitch-on-surface-variant/60 mt-0.5 leading-tight">{desc}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { plan, limits } = useFeatureGate();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canManageUsers = useCan('users.manage');
  const canAssignPermissions = useCan('users.permissions');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', role: 'cashier',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.cashier],
  });

  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editForm, setEditForm] = useState<FormState>({
    name: '', email: '', role: 'cashier', permissions: [],
  });

  const [resettingUser, setResettingUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    api.get<StaffUser[]>('/users')
      .then((r) => setUsers(r.data))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!loading && containerRef.current) {
      const els = containerRef.current.querySelectorAll('.user-row');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [loading, users]);

  const handleRoleChange = (role: Role, isEdit = false) => {
    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role] || [];
    if (isEdit) {
      setEditForm((prev) => ({ ...prev, role, permissions: [...defaultPerms] }));
    } else {
      setForm((prev) => ({ ...prev, role, permissions: [...defaultPerms] }));
    }
  };

  const handlePermissionToggle = (perm: Permission, isEdit = false) => {
    if (!canAssignPermissions) return;
    const toggle = (perms: Permission[]) =>
      perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm];
    if (isEdit) {
      setEditForm((prev) => ({ ...prev, permissions: toggle(prev.permissions) }));
    } else {
      setForm((prev) => ({ ...prev, permissions: toggle(prev.permissions) }));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) return;
    if (users.length >= limits.staffUsers) {
      setError(`Limit reached: Your current plan only allows up to ${limits.staffUsers} staff members.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/users', {
        name: form.name, email: form.email, password: form.password,
        role: form.role, permissions: form.permissions,
      });
      setSuccessMsg(`User ${form.name} created successfully.`);
      setShowAddForm(false);
      setForm({ name: '', email: '', password: '', role: 'cashier', permissions: [...ROLE_DEFAULT_PERMISSIONS.cashier] });
      load();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers || !editingUser) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${editingUser.id}`, {
        name: editForm.name, role: editForm.role, permissions: editForm.permissions,
      });
      setSuccessMsg(`User ${editForm.name} updated successfully.`);
      setEditingUser(null);
      load();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers || !resettingUser) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${resettingUser.id}/password`, { password: newPassword });
      setSuccessMsg(`Password reset for ${resettingUser.name}.`);
      setResettingUser(null);
      setNewPassword('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (userId: string, currentlyActive: boolean) => {
    if (!canManageUsers) return;
    setError('');
    try {
      await api.patch(`/users/${userId}`, { isActive: !currentlyActive });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !currentlyActive } : u));
      setSuccessMsg('User status updated.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to update user status');
    }
  };

  const startEdit = (user: StaffUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name, email: user.email, role: user.role,
      permissions: (user.permissions as Permission[]) || [],
    });
  };

  return (
    <div ref={containerRef} className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stitch-primary/10 flex items-center justify-center">
            <Users size={20} className="text-stitch-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stitch-on-surface font-space">Staff & Users</h1>
            <p className="text-xs text-stitch-on-surface-variant">Credentials, roles, and granular permissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-1.5 text-sm text-stitch-on-surface-variant hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canManageUsers && (
            <button
              onClick={() => {
                if (users.length >= limits.staffUsers) {
                  setError(`Limit reached: Your current plan only allows up to ${limits.staffUsers} staff members.`);
                  return;
                }
                setShowAddForm(true);
                setError('');
              }}
              disabled={users.length >= limits.staffUsers}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Plus size={15} /> Add Staff User
            </button>
          )}
        </div>
      </div>

      {/* Premium Upgrade alert banner when staff limit is reached */}
      {users.length >= limits.staffUsers && (
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white font-space uppercase tracking-wider">Staff Limit Reached ({users.length}/{limits.staffUsers})</h3>
              <p className="text-xs text-white/70 mt-1 leading-relaxed">
                Your current plan (<strong>{plan}</strong>) only allows up to {limits.staffUsers} active staff accounts. Upgrade to <strong>ElectroTrack Pro Core</strong> to get unlimited staff and cashier users.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/checkout?plan=pro')}
            className="px-3.5 py-1.5 bg-stitch-primary text-stitch-on-primary text-xs font-bold rounded-lg hover:bg-stitch-primary/90 transition-all shrink-0 font-space active:scale-95"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {error && (
        <div className="glass-card rounded-xl p-3 border-l-4 border-stitch-error/50">
          <p className="text-sm text-stitch-error">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="glass-card rounded-xl p-3 border-l-4 border-green-500/50">
          <p className="text-sm text-green-400">{successMsg}</p>
        </div>
      )}

      {/* ADD FORM */}
      {showAddForm && (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
              <Shield size={16} className="text-stitch-primary" /> New Staff Member
            </h2>
            <button onClick={() => setShowAddForm(false)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={users.length >= limits.staffUsers}
                  required placeholder="e.g. Ali Ahmed" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email (Username) *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={users.length >= limits.staffUsers}
                  required placeholder="e.g. ali@shop.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={users.length >= limits.staffUsers}
                  required minLength={8} placeholder="At least 8 characters" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Role Group *</label>
                <select value={form.role} onChange={(e) => handleRoleChange(e.target.value as Role)}
                  disabled={users.length >= limits.staffUsers}
                  className={selectCls}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-3">
                Granular Permissions
                {!canAssignPermissions && <span className="text-stitch-error font-normal normal-case ml-2">(Requires users.permissions)</span>}
              </p>
              <PermissionGrid permissions={form.permissions} canAssign={canAssignPermissions}
                onToggle={(p) => handlePermissionToggle(p)} />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-sm bg-stitch-primary text-stitch-on-primary font-bold rounded-lg hover:bg-stitch-primary/90 disabled:opacity-50 transition-all active:scale-95">
                {loading ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl p-6 w-full max-w-4xl border border-white/10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
              <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
                <Edit size={16} className="text-stitch-primary" /> Edit: {editingUser.name}
              </h2>
              <button onClick={() => setEditingUser(null)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-5 overflow-y-auto py-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Role Group *</label>
                  {editingUser.role === 'owner' ? (
                    <div className="w-full bg-stitch-surface-container-high/30 border border-white/5 text-stitch-on-surface-variant rounded-lg px-3 py-2 text-sm capitalize">
                      Owner (role locked)
                    </div>
                  ) : (
                    <select value={editForm.role} onChange={(e) => handleRoleChange(e.target.value as Role, true)}
                      className={selectCls}>
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-3">
                  Granular Permissions
                  {!canAssignPermissions && <span className="text-stitch-error font-normal normal-case ml-2">(Requires users.permissions)</span>}
                </p>
                {editingUser.role === 'owner' ? (
                  <p className="text-xs text-stitch-primary/70 italic">Owner has full operational bypass — individual toggles do not apply.</p>
                ) : (
                  <PermissionGrid permissions={editForm.permissions} canAssign={canAssignPermissions}
                    onToggle={(p) => handlePermissionToggle(p, true)} />
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/5 shrink-0">
                <button type="button" onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 text-sm bg-stitch-primary text-stitch-on-primary font-bold rounded-lg hover:bg-stitch-primary/90 disabled:opacity-50 transition-all active:scale-95">
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl p-6 w-full max-w-md border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
                <Key size={16} className="text-amber-400" /> Reset Password
              </h2>
              <button onClick={() => setResettingUser(null)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-xs text-stitch-on-surface-variant">
                Set a new password for <span className="font-semibold text-stitch-on-surface">{resettingUser.name}</span>.
              </p>
              <div>
                <label className={labelCls}>New Password *</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  required minLength={8} placeholder="At least 8 characters" className={inputCls} />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                <button type="button" onClick={() => setResettingUser(null)}
                  className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading || newPassword.length < 8}
                  className="px-4 py-2 text-sm bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-all active:scale-95">
                  {loading ? 'Updating…' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                {['User Details', 'Email', 'Role', 'Permissions', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
                {canManageUsers && (
                  <th className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={canManageUsers ? 6 : 5} className="px-4 py-16 text-center">
                    {loading ? (
                      <span className="inline-block w-6 h-6 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <Users size={32} className="mx-auto mb-2 text-stitch-on-surface-variant/30" />
                        <p className="text-sm text-stitch-on-surface-variant">No staff users found</p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isOwner = u.role === 'owner';
                  return (
                    <tr key={u.id} className="user-row hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stitch-on-surface text-sm">{u.name}</p>
                        <p className="text-[10px] text-stitch-on-surface-variant/50 font-mono mt-0.5">#{u.id.slice(-8)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-stitch-on-surface-variant font-mono">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${ROLE_COLORS[u.role]}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isOwner ? (
                          <span className="text-xs text-stitch-primary/70 font-mono">full bypass</span>
                        ) : (
                          <span className="text-xs text-stitch-on-surface-variant">{u.permissions?.length || 0} active</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.isActive
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-stitch-error/10 text-stitch-error border-stitch-error/20'
                        }`}>
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      {canManageUsers && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => startEdit(u)} title="Edit permissions"
                              className="p-1.5 text-stitch-on-surface-variant hover:text-stitch-primary rounded-lg hover:bg-stitch-primary/10 transition-colors">
                              <Edit size={14} />
                            </button>
                            {!isOwner ? (
                              <>
                                <button onClick={() => setResettingUser(u)} title="Reset password"
                                  className="p-1.5 text-stitch-on-surface-variant hover:text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors">
                                  <Key size={14} />
                                </button>
                                <button
                                  onClick={() => toggleActive(u.id, u.isActive)}
                                  title={u.isActive ? 'Deactivate' : 'Activate'}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    u.isActive
                                      ? 'text-stitch-on-surface-variant hover:text-stitch-error hover:bg-stitch-error/10'
                                      : 'text-stitch-on-surface-variant hover:text-green-400 hover:bg-green-500/10'
                                  }`}
                                >
                                  {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-stitch-on-surface-variant/30 italic px-2">locked</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
