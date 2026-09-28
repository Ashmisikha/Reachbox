import React from 'react';
import { Scale, CheckCircle2, AlertTriangle, Clock, Zap, ShieldAlert, Mail } from 'lucide-react';

export function TermsContent() {
  return (
    <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
        <Scale className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-white font-semibold text-sm">ReachInbox Terms of Service</h3>
          <p className="text-xs text-slate-400 mt-1">
            Effective Date: September 2026. Please review these terms carefully before scheduling emails or configuring
            worker pipelines on ReachInbox.
          </p>
        </div>
      </div>

      {/* Section 1: Service Scope */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          1. Service Scope & Infrastructure
        </h4>
        <p>
          ReachInbox provides distributed, high-throughput email scheduling, delayed job dispatching (via BullMQ and Redis),
          multi-sender SMTP relay orchestration, and recipient search indexing (via Elasticsearch). By accessing or creating an account,
          you agree to be bound by these Terms of Service.
        </p>
      </section>

      {/* Section 2: Acceptable Use & Anti-Spam */}
      <section className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          2. Acceptable Use Policy & Anti-Spam Compliance
        </h4>
        <p className="text-xs text-slate-300">
          ReachInbox has zero tolerance for spam, phishing, deceptive communications, or malicious activity:
        </p>
        <ul className="space-y-2 list-none pl-1 text-xs">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">Consent & Opt-In:</strong> You must only schedule emails to recipients who have explicitly consented to receive communications or with whom you have a legitimate, legal business relationship.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">Regulatory Adherence:</strong> Campaigns must comply with all applicable anti-spam and privacy legislation, including CAN-SPAM, GDPR, CASL, and regional telecom policies.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-200">Honest Sender Identification:</strong> You must provide truthful sender addresses, domain signatures, and accurate subject lines without misrepresenting identity.</span>
          </li>
        </ul>
      </section>

      {/* Section 3: Rate Limiting & Rescheduling Policy */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          3. Rate Limiting, Throttling & Job Rescheduling
        </h4>
        <p className="text-xs text-slate-300">
          To maintain domain reputation and prevent worker starvation, ReachInbox enforces automated scheduling safety rules:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-amber-300 block mb-1">Hourly Quotas</span>
            <p className="text-slate-400">
              When an account reaches its configured hourly threshold (<code className="text-slate-200">MAX_EMAILS_PER_HOUR</code>),
              remaining emails are not dropped; they are systematically deferred to the next hourly window.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-amber-300 block mb-1">Inter-Email Send Throttle</span>
            <p className="text-slate-400">
              The engine enforces a mandatory pacing delay (<code className="text-slate-200">MIN_EMAIL_DELAY_MS</code>) between consecutive
              dispatches across all concurrent workers.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: System Availability & Liability */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          4. Service Availability & Limitations
        </h4>
        <p className="text-xs text-slate-300">
          While ReachInbox is engineered for high reliability, fault tolerance, and restart safety:
        </p>
        <ul className="text-xs space-y-1.5 text-slate-400 list-disc pl-5">
          <li>We do not guarantee inbox placement rates, as final deliverability is governed by recipient mail server algorithms and spam filters.</li>
          <li>For testing environments, Ethereal SMTP test credentials should be used to simulate delivery without sending real external emails.</li>
          <li>ReachInbox is provided &quot;as is&quot; without warranties of any kind regarding third-party SMTP server availability or upstream provider interruptions.</li>
        </ul>
      </section>

      {/* Section 5: Termination & Inquiries */}
      <section className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-indigo-400" />
          <span>Questions about our Terms of Service?</span>
        </div>
        <a
          href="mailto:legal@reachinbox.ai"
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          legal@reachinbox.ai
        </a>
      </section>
    </div>
  );
}
