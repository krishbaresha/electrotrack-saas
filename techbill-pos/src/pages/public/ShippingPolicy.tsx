import { Truck, MapPin, Clock, ShieldCheck } from 'lucide-react';

export default function ShippingPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 dark:bg-[#c0c1ff]/10 text-blue-700 dark:text-[#c0c1ff] text-xs font-semibold uppercase tracking-wider mb-4 border border-blue-500/20 dark:border-[#c0c1ff]/20">
          <Truck size={12} className="text-[#2fd9f4]" />
          Express Distribution
        </div>
        <h1 className="font-space text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Shipping & Delivery Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-[#c7c4d7]">
          Last Updated: July 9, 2026
        </p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-[#c7c4d7]">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">1. Dispatch & Processing Timelines</h2>
          </div>
          <p>
            Online orders are dispatched within 24 hours of successful payment gateway verification. Upon dispatch, a unique tracking ID is linked to the transaction record, enabling real-time shipping status tracking (Pending → Dispatched → Delivered) in our web portal.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">2. Delivery Charges & Courier Partners</h2>
          </div>
          <p>
            Standard delivery charges are calculated dynamically based on regional distances and added to checkout subtotal amounts. We partner with reliable regional courier networks to coordinate cash-on-delivery (COD) collections and secure ledger reconciliations.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">3. Delivery Coverage & Exclusions</h2>
          </div>
          <p>
            We ship nationwide across Pakistan, including main metropolitan areas. Customers must ensure accurate city and street address inputs. We do not dispatch to P.O. boxes or military restricted zones. Handover of high-value electronic units is subject to serial number verification on delivery.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">4. Support & Logistics Inquiries</h2>
          </div>
          <p>
            If your order tracking status is delayed, or you receive damaged units, please contact our logistics support team immediately. All transit queries are monitored under our centralized enterprise audit logs:
          </p>
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-xs text-slate-600 dark:text-zinc-400">
            <p><strong>Office Address:</strong> Sakhi Wahab Tower 1st Floor,Shab Cinema Sakhi Pir Road, Hyderabad, Pakistan</p>
            <p className="mt-1"><strong>Helpline:</strong> +92 314 2291356</p>
            <p className="mt-1"><strong>Email:</strong> info@techbill.app</p>
          </div>
        </section>
      </div>
    </div>
  );
}
