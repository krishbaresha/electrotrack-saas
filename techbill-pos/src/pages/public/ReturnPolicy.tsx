import { ShieldAlert, RefreshCw, AlertCircle, FileCheck } from 'lucide-react';

export default function ReturnPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 dark:bg-[#c0c1ff]/10 text-emerald-700 dark:text-[#c0c1ff] text-xs font-semibold uppercase tracking-wider mb-4 border border-emerald-500/20 dark:border-[#c0c1ff]/20">
          <RefreshCw size={12} className="text-[#2fd9f4]" />
          Fair Exchange & Refund
        </div>
        <h1 className="font-space text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Return & Refund Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-[#c7c4d7]">
          Last Updated: July 9, 2026
        </p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-[#c7c4d7]">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">1. Standard Returns</h2>
          </div>
          <p>
            We offer a comprehensive 15-day return and exchange policy for all items purchased through our platform registers, provided the product remains in its original, sealed packaging. To initiate a return, customers must present the original digital QR invoice generated at checkout.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">2. Warranty & Defective Units</h2>
          </div>
          <p>
            For electronic components showing manufacturing defects, return windows are governed by the corresponding product warranty months registered in our inventory database. Defective units will undergo technical evaluation by certified technicians before exchange or store credit is approved.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">3. Return Fraud & Suspicious Activity</h2>
          </div>
          <p>
            To prevent return abuse, our system executes automated fraud checks. If a customer (tracked via phone/ID) attempts multiple returns exceeding our shop threshold within a 30-day window, a suspicious flag is logged, and the return requires manual owner/administrator authorization.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <FileCheck className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">4. Processing & Inquiries</h2>
          </div>
          <p>
            Approved refunds are issued as store credit or processed back via the original payment method (Cash, Easypaisa, Jazzcash, Card, Bank Transfer) within 3-5 business days. For policy inquiries, please contact our helpline or visit our offices:
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
