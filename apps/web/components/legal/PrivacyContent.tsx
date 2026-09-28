import React from 'react';
import { Shield, Lock, Eye, Server, RefreshCw, CheckCircle2, Mail } from 'lucide-react';

export function PrivacyContent() {
  return (
    <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-white font-semibold text-sm">Privacy & Data Governance at ReachInbox</h3>
          <p className="text-xs text-slate-400 mt-1">
            Last Updated: September 2026. This policy outlines how ReachInbox collects, processes, and protects your
            data, credentials, and email campaign workflows in strict compliance with global privacy standards and Google API User Data Policies.
          </p>
        </div>
      </div>

      {/* Section 1: Overview */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" />
          1. Information We Collect
        </h4>
        <p>
          ReachInbox operates a distributed email scheduling and queue management platform. To deliver these services,
          we process the following categories of information:
        </p>
        <ul className="space-y-2 list-none pl-1">
          <li className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">Account & Profile Data:</strong> Name, email address, and profile avatar retrieved via Google OAuth or local authentication.</span>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">Campaign & Dispatch Data:</strong> Recipient email addresses, subject lines, body templates, scheduling rules, and inter-message delay settings.</span>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">SMTP & Integration Credentials:</strong> Custom SMTP hosts, ports, Ethereal test accounts, and Slack incoming webhooks. Sensitive credentials are cryptographically protected.</span>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">Operational Telemetry:</strong> BullMQ job identifiers, delivery status, timestamp logs, and Elasticsearch search index metadata.</span>
          </li>
        </ul>
      </section>

      {/* Section 2: Google User Data */}
      <section className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-400" />
          2. Google API Services & Limited Use Compliance
        </h4>
        <p className="text-xs text-slate-300">
          ReachInbox requests Google OAuth scopes strictly for user identity verification (<code className="text-blue-400">openid</code>, <code className="text-blue-400">email</code>, <code className="text-blue-400">profile</code>).
        </p>
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-2">
          <p className="font-medium text-slate-200">Our Explicit Commitments:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>We do <strong>NOT</strong> sell user data to data brokers or third parties.</li>
            <li>We do <strong>NOT</strong> use Google user data to serve targeted advertisements.</li>
            <li>We do <strong>NOT</strong> train generalized artificial intelligence models on your email recipient lists or campaign messages.</li>
            <li>All transfer of data adheres directly to the <span className="text-blue-400 underline decoration-blue-500/40">Google API Services User Data Policy</span>, including the Limited Use requirements.</li>
          </ul>
        </div>
      </section>

      {/* Section 3: Architecture & Data Storage */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" />
          3. Storage Architecture & Protection
        </h4>
        <p>
          Our infrastructure is architected for persistence, fault-tolerance, and idempotency:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-white block mb-1">PostgreSQL Primary Storage</span>
            <p className="text-slate-400">Source-of-truth database for campaigns, sender accounts, delivery status states, and user profiles with transactional safety.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-white block mb-1">BullMQ & Redis Layer</span>
            <p className="text-slate-400">Used for delayed jobs, atomic rate-limiting counters, and concurrency locks. Redis keys are isolated with automated TTLs.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-white block mb-1">Elasticsearch Index</span>
            <p className="text-slate-400">Provides search across scheduled and sent emails. Indexed data mirrors database state and is kept strictly within your workspace boundary.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-white block mb-1">Encryption In-Transit & At-Rest</span>
            <p className="text-slate-400">All external network communication is encrypted over TLS 1.3. Internal service connections use secured protocols and isolated networks.</p>
          </div>
        </div>
      </section>

      {/* Section 4: Data Retention & User Rights */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          4. Retention & Your Rights
        </h4>
        <p className="text-xs text-slate-300">
          You retain complete ownership and sovereignty over your email content and recipient data:
        </p>
        <ul className="text-xs space-y-1.5 text-slate-400 list-disc pl-5">
          <li><strong>Right to Deletion:</strong> You may delete any campaign, recipient list, or completed queue logs at any time from your ReachInbox dashboard.</li>
          <li><strong>Workspace Export:</strong> You can export campaign metrics and delivery status logs directly in standard formats.</li>
          <li><strong>Idempotency Retention:</strong> To guarantee that emails are never sent twice during worker crashes, delivery deduplication keys are retained for a 7-day safety window before being safely purged.</li>
        </ul>
      </section>

      {/* Section 5: Contact & Inquiries */}
      <section className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          <span>Questions regarding privacy? Contact our Data Governance Team:</span>
        </div>
        <a
          href="mailto:privacy@reachinbox.ai"
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          privacy@reachinbox.ai
        </a>
      </section>
    </div>
  );
}
