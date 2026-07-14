import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { useCartStore, generateIdempotencyKey } from '../../store/cart.store';
import { queueSale } from '../../db/offline.db';
import { useCan } from '../../lib/permissions';
import { useLicenseStore } from '../../store/license.store';
import type { Sale, ShopSettings } from '../../types';

const schema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  trackingId: z.string().optional(),
  deliveryCharge: z.coerce.number().min(0).default(0),
  advanceAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(['cash', 'easypaisa', 'jazzcash', 'card', 'bank_transfer']),
  discountAmount: z.coerce.number().min(0).default(0),
  additionalCharges: z.coerce.number().min(0).default(0),
  description: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const formatPKR = (n: number) => `₨ ${n.toLocaleString('en-PK')}`;

const inputCls = 'w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors';
const labelCls = 'block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1';

export default function PaymentForm({ onSaleComplete, shopSettings }: { onSaleComplete: (sale: Sale) => void; shopSettings: ShopSettings | null }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { isOnlineOrder, setIsOnlineOrder, items } = useCartStore();
  const canSellOnline = useCan('pos.online_sell') && shopSettings?.tenant?.onlineSellingEnabled;
  const { license } = useLicenseStore();

  // Check if subscription has expired
  const isSubscriptionExpired = license?.isExpired ?? false;

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: 'cash', discountAmount: 0, additionalCharges: 0 },
  });
  const [activeAddOns, setActiveAddOns] = useState<string[]>([]);

  const handleToggleAddOn = (addOn: { name: string; amount: number; enabled: boolean }) => {
    const currentCharges = Number(getValues('additionalCharges') || 0);
    const currentDesc = getValues('description') || '';
    const isActive = activeAddOns.includes(addOn.name);

    let newCharges = currentCharges;
    let newDesc = currentDesc;

    if (isActive) {
      newCharges = Math.max(0, currentCharges - addOn.amount);
      const parts = currentDesc.split(',').map(p => p.trim()).filter(Boolean);
      const filteredParts = parts.filter(p => p !== addOn.name);
      newDesc = filteredParts.join(', ');
      setActiveAddOns(prev => prev.filter(name => name !== addOn.name));
    } else {
      newCharges = currentCharges + addOn.amount;
      const parts = currentDesc.split(',').map(p => p.trim()).filter(Boolean);
      if (!parts.includes(addOn.name)) {
        parts.push(addOn.name);
      }
      newDesc = parts.join(', ');
      setActiveAddOns(prev => [...prev, addOn.name]);
    }

    setValue('additionalCharges', newCharges);
    setValue('description', newDesc);
  };

  const discount = watch('discountAmount') ?? 0;
  const delivery = watch('deliveryCharge') ?? 0;
  const advance = watch('advanceAmount') ?? 0;
  const additionalCharges = watch('additionalCharges') ?? 0;
  const subtotal = items.reduce((s, i) => s + i.sellingPrice, 0);
  const total = Math.max(0, subtotal - Number(discount) + (isOnlineOrder ? Number(delivery) : 0) + Number(additionalCharges));
  const codAmount = Math.max(0, total - (isOnlineOrder ? Number(advance) : 0));

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    if (isOnlineOrder) {
      if (!data.customerName || !data.customerPhone || !data.customerCity) {
        setSubmitError('Name, Phone, and City are required for online orders.');
        return;
      }
    }
    const payload = {
      serials: items.map((i) => i.serialNumber),
      paymentMethod: data.paymentMethod,
      isOnline: isOnlineOrder,
      ...(isOnlineOrder && {
        customPrices: items.reduce((acc, i) => ({ ...acc, [i.serialNumber]: i.sellingPrice }), {} as Record<string, number>),
      }),
      ...(data.customerName && { customerName: data.customerName }),
      ...(data.customerPhone && { customerPhone: data.customerPhone }),
      ...(data.discountAmount && data.discountAmount > 0 && { discountAmount: data.discountAmount }),
      ...(data.additionalCharges && data.additionalCharges > 0 && { additionalCharges: data.additionalCharges }),
      ...(data.description && { description: data.description }),
      ...(isOnlineOrder && data.customerCity && { customerCity: data.customerCity }),
      ...(isOnlineOrder && data.trackingId && { trackingId: data.trackingId }),
      ...(isOnlineOrder && data.deliveryCharge > 0 && { deliveryCharge: data.deliveryCharge }),
      ...(isOnlineOrder && data.advanceAmount > 0 && { advanceAmount: data.advanceAmount }),
      ...(isOnlineOrder && { codAmount }),
      idempotencyKey: generateIdempotencyKey(),
    };
    try {
      const res = await api.post<Sale>('/sales', payload);
      onSaleComplete(res.data);
    } catch (err) {
      console.error('[PaymentForm Submission Error]', err);
      if (!navigator.onLine) {
        await queueSale(payload);
        setSubmitError('Offline — sale queued and will sync when connection returns');
      } else {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        const backendMsg = axiosErr.response?.data?.message ?? 'Failed to submit sale. Please try again.';
        setSubmitError(backendMsg);
      }
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 space-y-4 overflow-auto max-h-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-stitch-primary" />
          <p className="text-sm font-bold text-stitch-on-surface font-space">Payment Details</p>
        </div>
        {canSellOnline && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isOnlineOrder} onChange={(e) => setIsOnlineOrder(e.target.checked)} className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500/50" />
            <span className="text-xs font-bold text-indigo-400">Online Order</span>
          </label>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className={labelCls}>Customer Name {isOnlineOrder && '*'}</label>
          <input {...register('customerName')} className={inputCls} placeholder="Optional" required={isOnlineOrder} />
        </div>

        <div>
          <label className={labelCls}>Phone {isOnlineOrder && '*'}</label>
          <input {...register('customerPhone')} type="tel" className={inputCls} placeholder="03XX-XXXXXXX" required={isOnlineOrder} />
        </div>

        {isOnlineOrder && (
          <>
            <div>
              <label className={labelCls}>City *</label>
              <input {...register('customerCity')} className={inputCls} placeholder="e.g. Lahore" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Delivery Charge</label>
                <input {...register('deliveryCharge')} type="number" min={0} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Advance Paid</label>
                <input {...register('advanceAmount')} type="number" min={0} className={inputCls} placeholder="0" />
              </div>
            </div>
          </>
        )}

        <div>
          <label className={labelCls}>Payment Method</label>
          <select {...register('paymentMethod')} className={inputCls}>
            <option value="cash">Cash</option>
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
          {errors.paymentMethod && (
            <p className="text-xs text-stitch-error mt-1">{errors.paymentMethod.message}</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Discount (₨)</label>
          <input {...register('discountAmount')} type="number" min={0} className={inputCls} placeholder="0" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className={labelCls}>Additional Charges (₨)</label>
            {shopSettings?.quickAddOns && shopSettings.quickAddOns.some(a => a.enabled) && (
              <div className="flex gap-1.5 flex-wrap justify-end max-w-[70%]">
                {shopSettings.quickAddOns
                  .filter(a => a.enabled)
                  .map((addOn) => {
                    const isActive = activeAddOns.includes(addOn.name);
                    return (
                      <button
                        key={addOn.name}
                        type="button"
                        onClick={() => handleToggleAddOn(addOn)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all border font-space select-none ${
                          isActive
                            ? 'bg-stitch-primary border-stitch-primary text-stitch-on-primary shadow-sm shadow-stitch-primary/20'
                            : 'bg-white/5 border-white/10 text-stitch-on-surface-variant hover:bg-white/10 hover:text-stitch-on-surface'
                        }`}
                      >
                        {addOn.name} (+{addOn.amount})
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
          <input {...register('additionalCharges')} type="number" min={0} className={inputCls} placeholder="0" />
        </div>

        <div>
          <label className={labelCls}>Description (Optional)</label>
          <input {...register('description')} type="text" className={inputCls} placeholder="e.g. Service fee, extra wrapping" />
        </div>

        <div className="border-t border-white/5 pt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-stitch-on-surface-variant">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPKR(subtotal)}</span>
          </div>
          {Number(discount) > 0 && (
            <div className="flex justify-between text-xs text-stitch-on-surface-variant">
              <span>Discount</span>
              <span className="tabular-nums text-stitch-error">− {formatPKR(Number(discount))}</span>
            </div>
          )}
          {Number(additionalCharges) > 0 && (
            <div className="flex justify-between text-xs text-stitch-on-surface-variant">
              <span>Additional Charges</span>
              <span className="tabular-nums text-stitch-primary">+ {formatPKR(Number(additionalCharges))}</span>
            </div>
          )}
          {isOnlineOrder && Number(delivery) > 0 && (
            <div className="flex justify-between text-xs text-stitch-on-surface-variant">
              <span>Delivery</span>
              <span className="tabular-nums text-indigo-400">+ {formatPKR(Number(delivery))}</span>
            </div>
          )}
          {isOnlineOrder && Number(advance) > 0 && (
            <div className="flex justify-between text-xs text-stitch-on-surface-variant">
              <span>Advance Paid</span>
              <span className="tabular-nums text-green-400">− {formatPKR(Number(advance))}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-stitch-on-surface pt-1.5 border-t border-white/5">
            <span>{isOnlineOrder ? 'COD Amount' : 'Total'}</span>
            <span className="tabular-nums text-stitch-tertiary font-space">{formatPKR(isOnlineOrder ? codAmount : total)}</span>
          </div>
        </div>

        {submitError && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={11} />{submitError}
          </p>
        )}

        {isSubscriptionExpired && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Subscription expired — sales are disabled. Contact your platform admin to renew.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isSubscriptionExpired}
          className="w-full bg-stitch-primary hover:bg-stitch-primary/90 text-stitch-on-primary font-bold rounded-lg py-2.5 text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-stitch-on-primary/30 border-t-stitch-on-primary rounded-full animate-spin" />
          ) : null}
          {isSubscriptionExpired ? 'Sales Disabled — Subscription Expired' : isSubmitting ? 'Processing…' : `Confirm Sale — ${formatPKR(total)}`}
        </button>
      </form>
    </div>
  );
}
