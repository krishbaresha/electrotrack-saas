import { Scale, FileText, HelpCircle, ShieldAlert } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 dark:bg-[#c0c1ff]/10 text-indigo-700 dark:text-[#c0c1ff] text-xs font-semibold uppercase tracking-wider mb-4 border border-indigo-500/20 dark:border-[#c0c1ff]/20">
          <Scale size={12} className="text-[#2fd9f4]" />
          Platform Agreement
        </div>
        <h1 className="font-space text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-[#c7c4d7]">
          Last Updated: July 2, 2026
        </p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-[#c7c4d7]">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">1. Acceptance of Terms</h2>
          </div>
          <p>
            By establishing a tenant account, deploying an ElectroTrack node, or accessing the point-of-sale platform, you agree to be bound by these Terms of Service. These terms apply to all owners, managers, accountants, cashiers, and platform administrators across our multi-tenant SaaS environments.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">2. Account Registration & Tenant Security</h2>
          </div>
          <p>
            You are responsible for maintaining the confidentiality of your credentials, POS lock screen PINs, and API tokens. You agree to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Provide accurate database configuration and tenant ownership parameters.</li>
            <li>Promptly configure lock overlay parameters to enforce secure in-store sessions.</li>
            <li>Notify platform administrators immediately of unauthorized credential usage or token leaks.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">3. Usage Limitations & Local Cache Sync</h2>
          </div>
          <p>
            The software utilizes client-side Dexie IndexedDB caching to facilitate offline operational resilience. You acknowledge that transaction data must reconcile with the central database within reasonable timeframes to prevent data drift. System misuse, automated scraping of global tenant directories, or bypass attempts of isolated schemas will trigger immediate tenant suspension.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">4. Liability & Support</h2>
          </div>
          <p>
            ElectroTrack SaaS is provided "as is" and "as available". We do not guarantee continuous offline execution where local storage configurations are modified by the end-user. Please consult your Service Level Agreements (SLAs) regarding hardware integration, database backups, and custom Merchant of Record support timelines.
          </p>
        </section>
      </div>
    </div>
  );
}
