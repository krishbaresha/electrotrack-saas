import { Shield, Eye, Lock, FileText, Globe } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 dark:bg-[#c0c1ff]/10 text-indigo-700 dark:text-[#c0c1ff] text-xs font-semibold uppercase tracking-wider mb-4 border border-indigo-500/20 dark:border-[#c0c1ff]/20">
          <Shield size={12} className="text-[#2fd9f4]" />
          Trust & Transparency
        </div>
        <h1 className="font-space text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-[#c7c4d7]">
          Last Updated: July 2, 2026
        </p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-[#c7c4d7]">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">1. Information We Collect</h2>
          </div>
          <p>
            We collect information you provide directly to us when creating an account, setting up your boutique or tenant space, using the Point of Sale system, and communicating with us. This information may include:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Business name, registry details, and tax identification numbers.</li>
            <li>Contact details such as email addresses, physical office addresses, and phone numbers.</li>
            <li>Staff credentials, permissions, activity logs, and roles within the POS system.</li>
            <li>Inventory profiles, supplier information, and purchase order records.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">2. How We Use Information</h2>
          </div>
          <p>
            ElectroTrack SaaS utilizes the collected data to provide, maintain, and optimize our multi-tenant retail platform. Specifically, we use information to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Authorize account access and maintain isolated secure schema boundaries for each tenant.</li>
            <li>Process transactions, compile daily sales telemetry, and manage inventory databases.</li>
            <li>Facilitate real-time cloud-reconciliation and local sync caching using IndexedDB.</li>
            <li>Deliver automated digital invoices and supplier restock notifications.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">3. Data Security & Storage</h2>
          </div>
          <p>
            Data security is our primary focus. We implement standard cryptographic safeguards, row-level database security policies, and isolated token management systems (including automated refresh token rotations) to protect tenant operations. We store transaction logs and operational metadata on secure cloud networks, backed by standard industry availability guarantees.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">4. Contact & Compliance</h2>
          </div>
          <p>
            If you have questions about this policy, require data export assistance, or wish to report a security event, please contact our administrative team at support@electrotrack.io.
          </p>
        </section>
      </div>
    </div>
  );
}
