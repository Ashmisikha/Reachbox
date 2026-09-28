'use client';
import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Card } from '../../../components/ui';
import { Shield, LogOut, CheckCircle2, Key } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings & Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your ReachInbox account preferences, session, and security controls
        </p>
      </div>

      {/* ─── Profile Card ────────────────────────────────────────────────── */}
      <Card className="p-6 space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
          User Identity
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-16 h-16 rounded-full border-2 border-slate-200 object-cover shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 text-xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{user?.name}</h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active Account
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400">User ID (Internal):</span>
            <p className="font-mono text-slate-700 text-[11px] truncate mt-0.5">{user?.id}</p>
          </div>
          <div>
            <span className="text-slate-400">Authentication Method:</span>
            <p className="font-semibold text-slate-800 mt-0.5">Google OAuth 2.0</p>
          </div>
        </div>
      </Card>

      {/* ─── Security & Session Card ─────────────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
          Security & Session
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/60">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">HttpOnly Encrypted Cookie Session</p>
              <p className="text-slate-500 mt-0.5">
                Your session token is stored in an HttpOnly, secure cookie with SameSite=Lax protection to prevent XSS credential theft.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/60">
            <Key className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">PostgreSQL Session Persistence</p>
              <p className="text-slate-500 mt-0.5">
                Session tokens are cryptographically hashed and verified against PostgreSQL on every authenticated API invocation.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of ReachInbox</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
