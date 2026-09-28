'use client';
import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { SlackConnectionCard } from '../../../components/slack/SlackConnectionCard';
import { Card } from '../../../components/ui';
import { ShieldCheck, Mail } from 'lucide-react';

export default function IntegrationsPage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Integrations</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage third-party connections, notification channels, and infrastructure bindings
        </p>
      </div>

      {/* ─── Real Slack OAuth Integration (Phase 6) ─────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Alert & Notification Channels
        </h2>
        <SlackConnectionCard isAuthenticated={isAuthenticated} />
      </div>

      {/* ─── Connected System Services ──────────────────────────────────── */}
      <div className="space-y-3 pt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Core Engine Integrations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Google OAuth Identity */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Google OAuth 2.0</h3>
                  <p className="text-[11px] text-slate-500">Authentication & Identity</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-600 font-mono truncate">
              {user?.email || 'Logged in user'}
            </p>
          </Card>

          {/* Ethereal SMTP Transport */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Ethereal SMTP</h3>
                  <p className="text-[11px] text-slate-500">Nodemailer Dispatch</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Captures delivery message IDs and preview URLs for verification.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
