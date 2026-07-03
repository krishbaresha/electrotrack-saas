import { ShieldCheck, Server, Key, HeartHandshake } from 'lucide-react';

export default function Security() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 dark:bg-[#c0c1ff]/10 text-indigo-700 dark:text-[#c0c1ff] text-xs font-semibold uppercase tracking-wider mb-4 border border-indigo-500/20 dark:border-[#c0c1ff]/20">
          <ShieldCheck size={12} className="text-[#2fd9f4]" />
          Enterprise Compliance
        </div>
        <h1 className="font-space text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Security Requisitions
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-[#c7c4d7]">
          Last Updated: July 2, 2026
        </p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-600 dark:text-[#c7c4d7]">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Server className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">1. Architectural Isolation & Multi-Tenancy</h2>
          </div>
          <p>
            ElectroTrack is built on a multi-tenant database design. To ensure complete tenant isolation:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Database transactions utilize tenant-scoped Row-Level Security (RLS) policies.</li>
            <li>All system integrations pass through secure, validated gateway middleware.</li>
            <li>Tenant assets are stored in isolated block storage with signed URL access controls.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <Key className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">2. Authentication Hardening</h2>
          </div>
          <p>
            Our authorization framework employs industry-standard best practices:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>JWTs (JSON Web Tokens) with a short lifespan and automatic silent refresh cycles.</li>
            <li>Refresh tokens are stored in secure, HttpOnly, SameSite cookies to mitigate XSS and CSRF risks.</li>
            <li>Strict JWT verification and token rotation rules are enforced on the API backend.</li>
            <li>Client-side inactivity triggers an automatic POS lock screen to protect terminal hardware.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">3. Network Security & Data Encryption</h2>
          </div>
          <p>
            All network payloads are encrypted in transit using Transport Layer Security (TLS 1.3). Static data on our cloud infrastructure is encrypted using AES-256 standards. Offline replication data residing in user browsers is restricted to temporary IndexDB nodes and encrypted at the hardware level by modern operating system environments.
          </p>
        </section>

        <section className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <HeartHandshake className="text-indigo-600 dark:text-[#2fd9f4]" size={20} />
            <h2 className="font-space text-lg font-bold text-slate-900 dark:text-white m-0">4. Continuous Auditing</h2>
          </div>
          <p>
            ElectroTrack registers complete system audits. Every cashier checkout, stock adjust, manual database reconcile, and supplier request generates a signed, non-repudiable log audit path. Owners can verify administrative history inside the system's Audit log panel to prevent internal shrinkage or system misuse.
          </p>
        </section>
      </div>
    </div>
  );
}
