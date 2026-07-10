import { useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, X, ShieldAlert, CheckCircle, Ban, Edit3, Building2, Trash2, RotateCcw, CreditCard, Calendar, Key, Smartphone } from 'lucide-react';
import { api } from '../../api/client';
import type { Tenant } from '../../types';
import gsap from 'gsap';

interface CreateTenantForm {
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'premium' | 'enterprise';
  maxUsers: number;
  ownerName: string;
  ownerEmail: string;
  ownerPasswordHashOrText: string;
}

const PLAN_COLORS: Record<string, string> = {
  trial:      'bg-white/5 text-stitch-on-surface-variant border-white/10',
  starter:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  premium:    'bg-stitch-primary/10 text-stitch-primary border-stitch-primary/20',
  enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const inputCls = 'w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50';
const labelCls = 'block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteNow, setDeleteNow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<CreateTenantForm>({
    name: '', slug: '', plan: 'trial', maxUsers: 5,
    ownerName: '', ownerEmail: '', ownerPasswordHashOrText: '',
  });

  const [editForm, setEditForm] = useState({ plan: 'trial', maxUsers: 5, status: 'active', onlineSellingEnabled: false });

  const [renewingTenant, setRenewingTenant] = useState<Tenant | null>(null);
  const [renewStartDate, setRenewStartDate] = useState(new Date().toISOString().split('T')[0]);

  const [slugEdited, setSlugEdited] = useState(false);
  const [resettingPasswordTenant, setResettingPasswordTenant] = useState<Tenant | null>(null);
  const [newOwnerPassword, setNewOwnerPassword] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.get<Tenant[]>('/tenants')
      .then((r) => setTenants(r.data))
      .catch(() => setError('Failed to load tenants directory.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!loading && containerRef.current) {
      const els = containerRef.current.querySelectorAll('.tenant-row');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [loading, tenants]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/tenants', {
        ...form,
        username: form.ownerEmail,
        ownerEmail: undefined // ensure we don't send the raw one if the backend reads it
      });
      setSuccessMsg(`Tenant "${form.name}" registered successfully.`);
      setShowAddForm(false);
      setSlugEdited(false);
      setForm({ name: '', slug: '', plan: 'trial', maxUsers: 5, ownerName: '', ownerEmail: '', ownerPasswordHashOrText: '' });
      load();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to register tenant.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/tenants/${editingTenant.id}`, editForm);
      setSuccessMsg(`Tenant "${editingTenant.name}" updated.`);
      setEditingTenant(null);
      load();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to update tenant.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingPasswordTenant) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/tenants/${resettingPasswordTenant.id}/reset-owner-password`, { password: newOwnerPassword });
      setSuccessMsg(`Password reset successfully for owner of "${resettingPasswordTenant.name}".`);
      setResettingPasswordTenant(null);
      setNewOwnerPassword('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (tenant: Tenant) => {
    setError('');
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/tenants/${tenant.id}`, { status: newStatus });
      setTenants((prev) => prev.map((t) => t.id === tenant.id ? { ...t, status: newStatus } : t));
      setSuccessMsg(`Tenant "${tenant.name}" ${newStatus}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to change status.');
    }
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToDelete) return;
    if (deleteConfirmation !== 'Delete') {
      setError('You must type exactly "Delete" to confirm.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.delete(`/tenants/${tenantToDelete.id}?force=${deleteNow}`);
      setSuccessMsg(`Tenant "${tenantToDelete.name}" ${deleteNow ? 'deleted permanently' : 'scheduled for deletion'}.`);
      setTenantToDelete(null);
      setDeleteConfirmation('');
      setDeleteNow(false);
      load();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to delete tenant.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (tenant: Tenant) => {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/tenants/${tenant.id}/restore`);
      setSuccessMsg(`Tenant "${tenant.name}" restored successfully.`);
      load();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to restore tenant.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAppAccess = async (tenant: Tenant) => {
    setError('');
    try {
      const newVal = !tenant.appAccessEnabled;
      await api.patch(`/tenants/${tenant.id}/app-access`, { appAccessEnabled: newVal });
      setTenants((prev) => prev.map((t) => t.id === tenant.id ? { ...t, appAccessEnabled: newVal } : t));
      setSuccessMsg(`App access ${newVal ? 'enabled' : 'disabled'} for ${tenant.name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to toggle app access.');
    }
  };

  const openRenewModal = (tenant: Tenant) => {
    setRenewingTenant(tenant);
    setRenewStartDate(new Date().toISOString().split('T')[0]);
    setError('');
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingTenant) return;
    setError('');
    try {
      await api.post(`/tenants/${renewingTenant.id}/renew`, { startDate: renewStartDate });
      const endDate = new Date(renewStartDate);
      endDate.setDate(endDate.getDate() + 30);
      setSuccessMsg(`Subscription for "${renewingTenant.name}" activated from ${renewStartDate} to ${endDate.toISOString().split('T')[0]}.`);
      setRenewingTenant(null);
      load();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to renew subscription.');
    }
  };

  return (
    <div ref={containerRef} className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Building2 size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stitch-on-surface font-space">Platform Tenants</h1>
            <p className="text-xs text-stitch-on-surface-variant">Global SaaS management for shop registrations and subscription plans</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-1.5 text-sm text-stitch-on-surface-variant hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { setShowAddForm(true); setError(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all active:scale-95">
            <Plus size={15} /> Create Shop Tenant
          </button>
        </div>
      </div>

      {error && (
        <div className="fixed top-6 right-6 z-[9999] bg-stitch-surface-container-high/90 backdrop-blur-xl rounded-xl p-4 border border-stitch-error/30 border-l-4 border-l-stitch-error shadow-2xl min-w-[300px]">
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-3 items-center">
              <ShieldAlert size={18} className="text-stitch-error shrink-0" />
              <p className="text-sm text-stitch-error font-medium leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-stitch-error/70 hover:text-stitch-error shrink-0 pt-0.5">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="fixed top-6 right-6 z-[9999] bg-stitch-surface-container-high/90 backdrop-blur-xl rounded-xl p-4 border border-green-500/30 border-l-4 border-l-green-500 shadow-2xl min-w-[300px]">
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-3 items-center">
              <CheckCircle size={18} className="text-green-400 shrink-0" />
              <p className="text-sm text-green-400 font-medium leading-relaxed">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-green-400/70 hover:text-green-400 shrink-0 pt-0.5">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* CREATE FORM */}
      {showAddForm && (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
              <ShieldAlert size={16} className="text-indigo-400" /> Provision New Shop Tenant
            </h2>
            <button onClick={() => setShowAddForm(false)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Shop/Company Name *</label>
                <input value={form.name} onChange={(e) => {
                  const val = e.target.value;
                  if (!slugEdited) {
                    setForm({ ...form, name: val, slug: val.toLowerCase().replace(/[^a-z0-9-]/g, '') });
                  } else {
                    setForm({ ...form, name: val });
                  }
                }}
                  required placeholder="e.g. Galaxy Mobile Shop" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Slug (URL Segment) *</label>
                <input value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
                  }}
                  required placeholder="e.g. galaxy-mobile" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pricing Plan *</label>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as CreateTenantForm['plan'] })}
                  className={inputCls}>
                  <option value="trial">Trial Plan</option>
                  <option value="starter">Starter Plan</option>
                  <option value="premium">Premium Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>User Limit *</label>
                <input type="number" min={1} value={form.maxUsers}
                  onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 1 })}
                  required className={inputCls} />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-3">Primary Owner Account</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Owner Full Name *</label>
                  <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    required placeholder="e.g. Hammad Khan" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner Email Username *</label>
                  <div className="flex bg-stitch-surface-container-high/50 border border-white/10 rounded-lg overflow-hidden focus-within:border-stitch-primary/50 transition-colors">
                    <input type="text" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value.replace(/[^a-zA-Z0-9._-]/g, '') })}
                      required placeholder="hammad" className="w-full bg-transparent px-3 py-1.5 text-sm text-stitch-on-surface outline-none" />
                    <span className="flex items-center px-3 text-sm text-stitch-on-surface-variant bg-white/5 border-l border-white/5 select-none whitespace-nowrap">
                      @{form.slug || 'tenant'}.techbill.app
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Owner Password *</label>
                  <input type="password" value={form.ownerPasswordHashOrText}
                    onChange={(e) => setForm({ ...form, ownerPasswordHashOrText: e.target.value })}
                    required minLength={8} placeholder="At least 8 characters" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-sm bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">
                {loading ? 'Registering…' : 'Register Tenant & Owner'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl p-6 w-full max-w-md border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
                <Edit3 size={16} className="text-indigo-400" /> Edit: {editingTenant.name}
              </h2>
              <button onClick={() => setEditingTenant(null)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Pricing Plan</label>
                <select value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                  className={inputCls}>
                  <option value="trial">Trial Plan</option>
                  <option value="starter">Starter Plan</option>
                  <option value="premium">Premium Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>User Limit</label>
                <input type="number" min={1} value={editForm.maxUsers}
                  onChange={(e) => setEditForm({ ...editForm, maxUsers: parseInt(e.target.value) || 1 })}
                  className={inputCls} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="onlineSellingEnabled" 
                  checked={editForm.onlineSellingEnabled}
                  onChange={(e) => setEditForm({ ...editForm, onlineSellingEnabled: e.target.checked })}
                  className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500/50" />
                <label htmlFor="onlineSellingEnabled" className="text-sm font-medium text-stitch-on-surface">Enable Online Selling</label>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                <button type="button" onClick={() => setEditingTenant(null)}
                  className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">
                  {loading ? 'Updating…' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {tenantToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl p-6 w-full max-w-md border border-stitch-error/30 space-y-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-stitch-error/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                <h2 className="font-bold text-stitch-error font-space flex items-center gap-2">
                  <ShieldAlert size={16} /> Delete: {tenantToDelete.name}
                </h2>
                <button onClick={() => setTenantToDelete(null)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleDeleteSubmit} className="space-y-4">
                <p className="text-sm text-stitch-on-surface-variant">
                  This action is highly destructive.
                  <br />
                  If <strong>Delete now</strong> is unchecked, the shop will be suspended and deleted after 30 days (it can be restored before then).
                </p>
                <div>
                  <label className={labelCls}>Type "Delete" to confirm</label>
                  <input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)}
                    required placeholder="Delete" className={inputCls} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="deleteNow" 
                    checked={deleteNow}
                    onChange={(e) => setDeleteNow(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-stitch-error focus:ring-stitch-error/50" />
                  <label htmlFor="deleteNow" className="text-sm font-medium text-stitch-on-surface">Delete now (permanently erase data)</label>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-white/5 mt-4">
                  <button type="button" onClick={() => setTenantToDelete(null)}
                    className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading || deleteConfirmation !== 'Delete'}
                    className="px-4 py-2 text-sm bg-stitch-error text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-all active:scale-95">
                    {loading ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingPasswordTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl p-6 w-full max-w-sm border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
                <Key size={16} className="text-indigo-400" />
                Reset Password: {resettingPasswordTenant.name}
              </h2>
              <button onClick={() => setResettingPasswordTenant(null)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>New Password</label>
                <input
                  type="password"
                  value={newOwnerPassword}
                  onChange={(e) => setNewOwnerPassword(e.target.value)}
                  required minLength={8}
                  placeholder="At least 8 characters"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                <button type="button" onClick={() => setResettingPasswordTenant(null)}
                  className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50">
                  <Key size={14} />
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW / ACTIVATE MODAL */}
      {renewingTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-xl p-6 w-full max-w-sm border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="font-bold text-stitch-on-surface font-space flex items-center gap-2">
                <Calendar size={16} className="text-green-400" />
                {renewingTenant.currentPeriodEnd ? 'Renew' : 'Activate'}: {renewingTenant.name}
              </h2>
              <button onClick={() => setRenewingTenant(null)} className="text-stitch-on-surface-variant hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Subscription Start Date</label>
                <input
                  type="date"
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  required
                  className={inputCls}
                />
                <p className="text-[10px] text-stitch-on-surface-variant mt-1.5">
                  Subscription will be valid for 30 days from this date
                  {renewStartDate && (() => {
                    const end = new Date(renewStartDate);
                    end.setDate(end.getDate() + 30);
                    return ` (expires ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`;
                  })()}
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                <button type="button" onClick={() => setRenewingTenant(null)}
                  className="px-4 py-2 text-sm text-stitch-on-surface-variant border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all active:scale-95 flex items-center gap-1.5">
                  <CreditCard size={14} />
                  {renewingTenant.currentPeriodEnd ? 'Renew Subscription' : 'Activate Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TENANTS TABLE */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stitch-surface-container-high/50 border-b border-white/5">
                {['Company & Slug', 'Owner Email', 'Plan', 'Users', 'Limit', 'Status', 'Billing', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    {loading ? (
                      <span className="inline-block w-6 h-6 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <Building2 size={32} className="mx-auto mb-2 text-stitch-on-surface-variant/30" />
                        <p className="text-sm text-stitch-on-surface-variant">No tenants provisioned yet.</p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="tenant-row hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-stitch-on-surface text-sm">{t.name}</p>
                      <p className="text-[10px] text-stitch-tertiary font-mono mt-0.5">/{t.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-stitch-on-surface-variant">{t.ownerEmail || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${PLAN_COLORS[t.plan] ?? ''}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-stitch-on-surface-variant">{t._count?.users ?? 0}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-stitch-on-surface-variant">{t.maxUsers}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                        t.status === 'active'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-stitch-error/10 text-stitch-error border-stitch-error/20'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        if (!t.currentPeriodEnd) {
                          return (
                            <button onClick={() => openRenewModal(t)}
                              title="Start subscription (30 days)"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
                              <CreditCard size={12} /> Activate
                            </button>
                          );
                        }
                        const now = new Date();
                        const end = new Date(t.currentPeriodEnd);
                        const diffMs = end.getTime() - now.getTime();
                        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        const isExpired = daysLeft <= 0;
                        return (
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-bold ${
                              isExpired ? 'text-red-400' : daysLeft <= 2 ? 'text-amber-400' : 'text-green-400'
                            }`}>
                              {isExpired ? 'Expired' : `${daysLeft}d left`}
                            </span>
                            <span className="text-[9px] text-stitch-on-surface-variant font-mono">
                              {end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => openRenewModal(t)}
                              title="Renew subscription (30 days from chosen date)"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors w-fit">
                              <CreditCard size={10} /> Renew
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleAppAccess(t)}
                          title={t.appAccessEnabled ? 'Disable App Access' : 'Enable App Access'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            t.appAccessEnabled
                              ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                              : 'text-stitch-on-surface-variant hover:text-green-400 hover:bg-green-500/10'
                          }`}>
                          <Smartphone size={14} className={!t.appAccessEnabled ? 'opacity-50' : ''} />
                        </button>
                        <button
                          onClick={() => { setResettingPasswordTenant(t); setNewOwnerPassword(''); }}
                          title="Reset Owner Password"
                          className="p-1.5 text-stitch-on-surface-variant hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-colors">
                          <Key size={14} />
                        </button>
                        <button
                          onClick={() => { setEditingTenant(t); setEditForm({ plan: t.plan, maxUsers: t.maxUsers, status: t.status, onlineSellingEnabled: t.onlineSellingEnabled }); }}
                          title="Edit Tenant"
                          className="p-1.5 text-stitch-on-surface-variant hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-colors">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => toggleStatus(t)}
                          title={t.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            t.status === 'active'
                              ? 'text-stitch-on-surface-variant hover:text-stitch-error hover:bg-stitch-error/10'
                              : 'text-stitch-on-surface-variant hover:text-green-400 hover:bg-green-500/10'
                          }`}>
                          {t.status === 'active' ? <Ban size={14} /> : <CheckCircle size={14} />}
                        </button>
                        {t.status === 'pending_deletion' ? (
                          <button onClick={() => handleRestore(t)}
                            title="Restore Tenant"
                            className="p-1.5 text-stitch-on-surface-variant hover:text-green-400 rounded-lg hover:bg-green-500/10 transition-colors">
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button onClick={() => { setTenantToDelete(t); setDeleteConfirmation(''); setDeleteNow(false); }}
                            title="Delete Tenant"
                            className="p-1.5 text-stitch-on-surface-variant hover:text-stitch-error rounded-lg hover:bg-stitch-error/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
