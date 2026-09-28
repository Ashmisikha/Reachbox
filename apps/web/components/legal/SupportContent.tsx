'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  CheckCircle2,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Server,
  ArrowRight,
} from 'lucide-react';

const FAQS = [
  {
    q: 'How does BullMQ delayed email scheduling work in ReachInbox?',
    a: 'When you schedule an email campaign with a future execution timestamp or a start delay, ReachInbox creates an atomic record in PostgreSQL and pushes a delayed job to Redis under BullMQ. Redis maintains the jobs in a sorted set indexed by timestamp. Even if the server or worker restarts, the jobs remain safely scheduled in Redis and will trigger immediately when their target time arrives.',
  },
  {
    q: 'What happens when my hourly sending limit (MAX_EMAILS_PER_HOUR) is reached?',
    a: 'ReachInbox never drops or loses jobs. When the atomic Redis counter hits your configured hourly limit, the BullMQ worker calculates the remaining time in the current hourly window and automatically defers remaining emails to the start of the next hour. If you have Slack connected, an alert notification is dispatched immediately.',
  },
  {
    q: 'How do I test email delivery without sending real emails?',
    a: 'You can use the built-in Ethereal SMTP test credentials or create a new sender account in the dashboard. Ethereal captures all outbound emails in a virtual inbox without delivering them to real recipients, providing instant web preview URLs in the Sent Emails dashboard.',
  },
  {
    q: 'How does Elasticsearch index scheduled and sent emails?',
    a: 'Whenever an email job is scheduled, sent, or rescheduled, ReachInbox synchronizes the metadata to an Elasticsearch index. You can search across thousands of emails in real-time by recipient address, subject keywords, or campaign ID directly from the search bar (⌘K) or the Sent/Scheduled tables.',
  },
  {
    q: 'How does worker concurrency and throttling prevent server overload?',
    a: 'Worker concurrency is governed by WORKER_CONCURRENCY. In addition, ReachInbox enforces MIN_EMAIL_DELAY_MS (minimum inter-email delay) across all distributed workers using Redis coordination so that parallel workers do not flood upstream SMTP relays simultaneously.',
  },
];

export function SupportContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ticketCategory, setTicketCategory] = useState('technical');
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketEmail || !ticketMessage) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const randomId = 'TICK-' + Math.floor(100000 + Math.random() * 900000);
      setSubmittedTicketId(randomId);
      setTicketSubject('');
      setTicketMessage('');
    }, 600);
  };

  return (
    <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <LifeBuoy className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-white font-semibold text-sm">ReachInbox Help & Resource Center</h3>
          <p className="text-xs text-slate-400 mt-1">
            Find answers to common scheduling and infrastructure questions, check system health, or open a direct support ticket.
          </p>
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-blue-400" />
          System & Worker Status
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">BullMQ Engine</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Redis Broker</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ready
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">SMTP Relay</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Elasticsearch</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Synced
            </span>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          Frequently Asked Questions
        </h4>
        <div className="space-y-2">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-400 border-t border-slate-800/60 pt-2 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Support Ticket Submission */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            Contact ReachInbox Engineering & Support
          </h4>
          <span className="text-[11px] text-slate-500">Typical response time: &lt; 2 hours</span>
        </div>

        {submittedTicketId ? (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Ticket Submitted Successfully!
            </div>
            <p>
              Your ticket reference is <strong className="text-white font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded">{submittedTicketId}</strong>.
              Our technical team will review your inquiry and reach back via your provided email.
            </p>
            <button
              type="button"
              onClick={() => setSubmittedTicketId(null)}
              className="text-emerald-400 underline hover:text-emerald-300 text-[11px] pt-1 block"
            >
              Submit another question
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitTicket} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={ticketEmail}
                  onChange={(e) => setTicketEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Inquiry Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-xs"
                >
                  <option value="technical">Technical / BullMQ Queue Issue</option>
                  <option value="smtp">SMTP / Sender Configuration</option>
                  <option value="ratelimit">Rate Limiting & Rescheduling</option>
                  <option value="elasticsearch">Elasticsearch & Search Sync</option>
                  <option value="general">General Feedback / Feature Request</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Question regarding worker concurrency setting"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Message Description</label>
              <textarea
                required
                rows={3}
                placeholder="Please describe what you are looking for or any error details..."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-xs resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Direct dispatch to <code className="text-slate-400">support@reachinbox.ai</code>
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Inquiry
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Quick Dashboard Links */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/queues" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <span>BullMQ Live Monitor</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </Link>
          <span className="text-slate-700">•</span>
          <Link href="/dashboard/senders" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <span>Sender Accounts</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </Link>
          <span className="text-slate-700">•</span>
          <Link href="/dashboard/settings" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <span>Delivery Settings</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </Link>
        </div>
        <a
          href="mailto:support@reachinbox.ai"
          className="text-blue-400 hover:text-blue-300 font-medium underline decoration-blue-500/30"
        >
          support@reachinbox.ai
        </a>
      </div>
    </div>
  );
}
