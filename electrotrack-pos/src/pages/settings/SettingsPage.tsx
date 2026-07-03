import { useEffect, useRef, useState } from 'react';
import { Settings, CheckCircle, AlertTriangle, Building2, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth.store';
import { useLockStore } from '../../store/lock.store';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import type { ShopSettings } from '../../types';
import gsap from 'gsap';

interface SettingsForm {
  shopName: string;
  lowStockThreshold: string;
  deadStockDays: string;
  maxDiscountWithoutOtp: string;
  returnFraudWindowDays: string;
  returnFraudCountThreshold: string;
  logoUrl: string;
  invoiceFontFamily: string;
  invoicePrimaryColor: string;
  invoiceAccentColor: string;
  invoiceFooterNotes: string;
  invoiceWatermarkText: string;
  invoiceShowWatermark: boolean;
}

const inputCls = 'w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50';
const labelCls = 'block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1';

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
}

function FieldGroup({ title, children }: FieldGroupProps) {
  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-stitch-on-surface font-space">{title}</h2>
      {children}
    </div>
  );
}

const FONT_OPTIONS = ['Inter', 'system-ui', 'Georgia', 'Courier New', 'Helvetica'];

export default function SettingsPage() {
  const { user, accessToken, setAuth } = useAuthStore();
  const { isPinSet, setPin, clearPin, autoLockMinutes, setAutoLockMinutes } = useLockStore();
  const navigate = useNavigate();
  const { plan, limits } = useFeatureGate();

  const [locations, setLocations] = useState<{ id: string; name: string; address: string }[]>(() => {
    const saved = localStorage.getItem('et-locations');
    return saved ? JSON.parse(saved) : [{ id: '1', name: 'Main Headquarters', address: 'Plot 42, Sector 15, Karachi' }];
  });
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    if (locations.length >= limits.locations) {
      setShowUpgradeBanner(true);
      return;
    }

    const newLoc = {
      id: crypto.randomUUID(),
      name: newLocName.trim(),
      address: newLocAddress.trim() || 'No address specified',
    };
    const updated = [...locations, newLoc];
    setLocations(updated);
    localStorage.setItem('et-locations', JSON.stringify(updated));
    setNewLocName('');
    setNewLocAddress('');
    setShowUpgradeBanner(false);
  };

  const handleRemoveLocation = (id: string) => {
    if (locations.length <= 1) return;
    const updated = locations.filter((loc) => loc.id !== id);
    setLocations(updated);
    localStorage.setItem('et-locations', JSON.stringify(updated));
  };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // App Lock PIN Settings state
  const [settingsPin, setSettingsPin] = useState('');
  const [settingsConfirmPin, setSettingsConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [form, setForm] = useState<SettingsForm>({
    shopName: '',
    lowStockThreshold: '2',
    deadStockDays: '60',
    maxDiscountWithoutOtp: '500',
    returnFraudWindowDays: '30',
    returnFraudCountThreshold: '2',
    logoUrl: '',
    invoiceFontFamily: 'Inter',
    invoicePrimaryColor: '#ffffff',
    invoiceAccentColor: '#14b8a6',
    invoiceFooterNotes: '',
    invoiceWatermarkText: '',
    invoiceShowWatermark: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.get<ShopSettings>('/settings')
      .then((r) => {
        const s = r.data;
        setForm({
          shopName: s.shopName,
          lowStockThreshold: String(s.lowStockThreshold),
          deadStockDays: String(s.deadStockDays),
          maxDiscountWithoutOtp: String(s.maxDiscountWithoutOtp),
          returnFraudWindowDays: String(s.returnFraudWindowDays),
          returnFraudCountThreshold: String(s.returnFraudCountThreshold),
          logoUrl: s.logoUrl ?? '',
          invoiceFontFamily: s.invoiceFontFamily ?? 'Inter',
          invoicePrimaryColor: s.invoicePrimaryColor ?? '#ffffff',
          invoiceAccentColor: s.invoiceAccentColor ?? '#14b8a6',
          invoiceFooterNotes: s.invoiceFooterNotes ?? '',
          invoiceWatermarkText: s.invoiceWatermarkText ?? '',
          invoiceShowWatermark: s.invoiceShowWatermark ?? false,
        });
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && containerRef.current) {
      const els = containerRef.current.querySelectorAll('.glass-card');
      gsap.killTweensOf(els);
      const tw = gsap.fromTo(els,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' },
      );
      return () => { tw.kill(); };
    }
  }, [loading]);

  const set = (key: keyof SettingsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch('/settings', {
        shopName: form.shopName || undefined,
        lowStockThreshold: parseInt(form.lowStockThreshold),
        deadStockDays: parseInt(form.deadStockDays),
        maxDiscountWithoutOtp: parseFloat(form.maxDiscountWithoutOtp),
        returnFraudWindowDays: parseInt(form.returnFraudWindowDays),
        returnFraudCountThreshold: parseInt(form.returnFraudCountThreshold),
        logoUrl: form.logoUrl || null,
        invoiceFontFamily: form.invoiceFontFamily,
        invoicePrimaryColor: form.invoicePrimaryColor,
        invoiceAccentColor: form.invoiceAccentColor,
        invoiceFooterNotes: form.invoiceFooterNotes || null,
        invoiceWatermarkText: form.invoiceWatermarkText || null,
        invoiceShowWatermark: form.invoiceShowWatermark,
      });
      setSuccessMsg('Settings saved');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (form.shopName && user && accessToken) {
        setAuth({ ...user, tenantName: form.shopName }, accessToken);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePin = () => {
    if (settingsPin.length !== 4) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }
    if (settingsPin !== settingsConfirmPin) {
      setPinError('PINs do not match.');
      return;
    }
    setPin(settingsPin);
    setSettingsPin('');
    setSettingsConfirmPin('');
    setPinError('');
    setPinSuccess('PIN updated successfully!');
    setTimeout(() => setPinSuccess(''), 3000);
  };

  const handleDisableLock = () => {
    clearPin();
    setPinSuccess('App lock disabled successfully.');
    setTimeout(() => setPinSuccess(''), 3000);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-stitch-primary/10 flex items-center justify-center">
          <Settings size={20} className="text-stitch-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stitch-on-surface font-space">Shop Settings</h1>
          <p className="text-xs text-stitch-on-surface-variant">Configure thresholds, controls, and invoice template</p>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-2 border-l-4 border-stitch-error/50">
          <AlertTriangle size={14} className="text-stitch-error shrink-0" />
          <p className="text-sm text-stitch-error">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-2 border-l-4 border-green-500/50">
          <CheckCircle size={14} className="text-green-400 shrink-0" />
          <p className="text-sm text-green-400">{successMsg}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <FieldGroup title="General">
          <div>
            <label className={labelCls}>Shop Name</label>
            <input value={form.shopName} onChange={set('shopName')} className={inputCls} />
          </div>
        </FieldGroup>

        <FieldGroup title="Inventory Alerts">
          <div>
            <label className={labelCls}>Low Stock Threshold (units)</label>
            <input type="number" min="1" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} className={inputCls} />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Alert when in-stock units fall below this number</p>
          </div>
          <div>
            <label className={labelCls}>Dead Stock Days</label>
            <input type="number" min="1" value={form.deadStockDays} onChange={set('deadStockDays')} className={inputCls} />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Units unsold for longer than this are flagged as dead stock</p>
          </div>
        </FieldGroup>

        <FieldGroup title="Sales Controls">
          <div>
            <label className={labelCls}>Max Discount Without OTP (₨)</label>
            <input type="number" min="0" step="0.01" value={form.maxDiscountWithoutOtp} onChange={set('maxDiscountWithoutOtp')} className={inputCls} />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Discounts above this amount require owner OTP approval</p>
          </div>
        </FieldGroup>

        <FieldGroup title="Fraud Detection">
          <div>
            <label className={labelCls}>Return Fraud Window (days)</label>
            <input type="number" min="1" value={form.returnFraudWindowDays} onChange={set('returnFraudWindowDays')} className={inputCls} />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Look-back window for detecting repeat returns from the same customer</p>
          </div>
          <div>
            <label className={labelCls}>Return Fraud Count Threshold</label>
            <input type="number" min="1" value={form.returnFraudCountThreshold} onChange={set('returnFraudCountThreshold')} className={inputCls} />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Flag as suspicious if customer has this many returns in the window</p>
          </div>
        </FieldGroup>

        <FieldGroup title="Invoice Template">
          <div>
            <label className={labelCls}>Logo URL</label>
            <input value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://..." className={inputCls} />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Publicly accessible image URL shown at the top of invoices</p>
          </div>
          {form.logoUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <img src={form.logoUrl} alt="Logo preview" className="h-10 w-auto object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <p className="text-xs text-stitch-on-surface-variant">Logo preview</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.invoicePrimaryColor}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoicePrimaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                />
                <input value={form.invoicePrimaryColor} onChange={set('invoicePrimaryColor')} placeholder="#ffffff" className={`${inputCls} flex-1`} />
              </div>
              <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Shop name & heading color</p>
            </div>
            <div>
              <label className={labelCls}>Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.invoiceAccentColor}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoiceAccentColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                />
                <input value={form.invoiceAccentColor} onChange={set('invoiceAccentColor')} placeholder="#14b8a6" className={`${inputCls} flex-1`} />
              </div>
              <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Serial numbers & QR color</p>
            </div>
          </div>
          <div>
            <label className={labelCls}>Invoice Font</label>
            <select value={form.invoiceFontFamily} onChange={set('invoiceFontFamily')}
              className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors">
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Footer Notes</label>
            <textarea
              value={form.invoiceFooterNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceFooterNotes: e.target.value }))}
              placeholder="e.g. All sales are final. Warranty claims require original receipt."
              rows={2}
              className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50 resize-none"
            />
            <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">Printed at the bottom of every invoice</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Watermark Text</label>
              <input value={form.invoiceWatermarkText} onChange={set('invoiceWatermarkText')} placeholder="e.g. PAID" className={inputCls} />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setForm((prev) => ({ ...prev, invoiceShowWatermark: !prev.invoiceShowWatermark }))}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.invoiceShowWatermark ? 'bg-stitch-primary' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.invoiceShowWatermark ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-stitch-on-surface-variant">Show watermark</span>
              </label>
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Branch Locations (Multi-Location Syncing)">
          <div className="space-y-4">
            <p className="text-[11px] text-stitch-on-surface-variant/80 leading-relaxed">
              Register and sync your store branch locations. Your active plan (<strong>{plan}</strong>) supports up to <strong>{limits.locations === Infinity ? 'Unlimited' : limits.locations}</strong> branches.
            </p>

            {/* List of existing locations */}
            <div className="space-y-2">
              {locations.map((loc, i) => (
                <div key={loc.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded-lg">
                  <div>
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      <Building2 size={13} className="text-stitch-primary" /> {loc.name} {i === 0 && <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-normal font-sans">Primary</span>}
                    </p>
                    <p className="text-[11px] text-stitch-on-surface-variant/80 mt-0.5">{loc.address}</p>
                  </div>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc.id)}
                      className="p-1.5 hover:bg-stitch-error/10 hover:text-stitch-error text-white/40 border border-transparent hover:border-stitch-error/20 rounded-lg transition-colors"
                      title="Remove branch"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Form to add a location */}
            <div className="border-t border-white/5 pt-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Branch Name (e.g., Gulshan Outlet)"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    disabled={locations.length >= limits.locations}
                    className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50"
                  />
                  <input
                    type="text"
                    placeholder="Address (e.g., University Road, Karachi)"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                    disabled={locations.length >= limits.locations}
                    className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLocation}
                  disabled={locations.length >= limits.locations && !showUpgradeBanner}
                  className="px-3 bg-stitch-primary/10 text-stitch-primary border border-stitch-primary/20 rounded-lg text-xs font-bold hover:bg-stitch-primary/25 disabled:opacity-40 transition-colors flex items-center justify-center shrink-0"
                >
                  <Plus size={14} className="mr-1" /> Add Branch
                </button>
              </div>
            </div>

            {/* Premium Upgrade Banner */}
            {showUpgradeBanner && (
              <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 backdrop-blur-md relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="absolute top-0 right-0 p-2 text-[9px] bg-indigo-500/20 text-[#c0c1ff] font-bold rounded-bl-lg font-space uppercase tracking-wider">
                  Premium Feature
                </div>
                <h3 className="text-xs font-bold text-white font-space">Unlock Multi-Location Syncing</h3>
                <p className="text-[11px] text-white/70 mt-2 leading-relaxed">
                  Your current plan (<strong>{plan}</strong>) is limited to {limits.locations} location. Upgrade to <strong>ElectroTrack Pro</strong> to manage up to 3 branches, or get <strong>Industrial Enterprise</strong> for unlimited locations.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/checkout?plan=pro')}
                    className="px-3 py-1.5 bg-stitch-primary text-stitch-on-primary text-[10px] font-bold rounded-lg hover:bg-stitch-primary/90 transition-all"
                  >
                    Upgrade to Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeBanner(false)}
                    className="px-3 py-1.5 border border-white/10 hover:bg-white/5 text-white/75 text-[10px] font-semibold rounded-lg transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </FieldGroup>

        <FieldGroup title="App Lock Security">
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-white">App Lock Status</p>
                <p className="text-[11px] text-stitch-on-surface-variant/80 mt-0.5">
                  {isPinSet
                    ? 'Security PIN is set and active.'
                    : 'PIN is not set. Screen lock is disabled.'}
                </p>
              </div>
              {isPinSet && (
                <button
                  type="button"
                  onClick={handleDisableLock}
                  className="px-3 py-1 bg-stitch-error/15 text-stitch-error hover:bg-stitch-error/25 border border-stitch-error/20 rounded-lg text-xs font-semibold transition-colors"
                >
                  Disable App Lock
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{isPinSet ? 'Change PIN (4 digits)' : 'Set PIN (4 digits)'}</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={settingsPin}
                  onChange={(e) => setSettingsPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50 text-center tracking-widest text-base font-bold"
                />
              </div>
              <div>
                <label className={labelCls}>Confirm PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={settingsConfirmPin}
                  onChange={(e) => setSettingsConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50 text-center tracking-widest text-base font-bold"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleUpdatePin}
                disabled={settingsPin.length !== 4 || settingsConfirmPin.length !== 4}
                className="px-4 py-1.5 bg-stitch-primary/10 text-stitch-primary border border-stitch-primary/20 rounded-lg text-xs font-semibold hover:bg-stitch-primary/25 disabled:opacity-40 transition-colors"
              >
                {isPinSet ? 'Update PIN' : 'Save PIN'}
              </button>
            </div>

            {pinError && (
              <div className="flex items-center gap-2 text-xs text-stitch-error bg-stitch-error/10 border border-stitch-error/20 p-2 rounded-lg leading-none">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{pinError}</span>
              </div>
            )}
            {pinSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 p-2 rounded-lg leading-none">
                <CheckCircle size={12} className="shrink-0" />
                <span>{pinSuccess}</span>
              </div>
            )}

            <div className="pt-2 border-t border-white/5">
              <label className={labelCls}>Auto-Lock Inactivity Timer</label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(parseInt(e.target.value))}
                className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors"
              >
                <option value={0}>Disabled</option>
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes</option>
                <option value={30}>30 Minutes</option>
              </select>
              <p className="text-[10px] text-stitch-on-surface-variant/60 mt-1">
                Automatically lock screen if no activity (clicks, keys, mouse movement) is detected.
              </p>
            </div>
          </div>
        </FieldGroup>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-stitch-primary text-stitch-on-primary text-sm font-bold rounded-lg hover:bg-stitch-primary/90 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-stitch-on-primary/30 border-t-stitch-on-primary rounded-full animate-spin" />
              Saving…
            </>
          ) : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
