'use client';
import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { SlackConnectionCard } from '../../../components/slack/SlackConnectionCard';
import { Card, PageHeader } from '../../../components/ui';
import {
  Mail,
  Database,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function IntegrationsPage() {
  const { user, isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<'ALL' | 'GOOGLE' | 'SLACK' | 'SMTP' | 'ELASTICSEARCH'>('ALL');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Integrations"
        description="Connect and manage external services, authentication providers, and delivery pipelines."
      />

      {/* ─── Filter Tabs (Screen 15 in PDF) ──────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80 w-fit text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            filter === 'ALL'
              ? 'bg-white text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('GOOGLE')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            filter === 'GOOGLE'
              ? 'bg-white text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Google
        </button>
        <button
          onClick={() => setFilter('SLACK')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            filter === 'SLACK'
              ? 'bg-white text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Slack
        </button>
        <button
          onClick={() => setFilter('SMTP')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            filter === 'SMTP'
              ? 'bg-white text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          SMTP
        </button>
        <button
          onClick={() => setFilter('ELASTICSEARCH')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            filter === 'ELASTICSEARCH'
              ? 'bg-white text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Elasticsearch
        </button>
      </div>

      {/* ─── Integration List ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* 1. Google OAuth */}
        {(filter === 'ALL' || filter === 'GOOGLE') && (
          <Card className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Google OAuth</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Account identity, session establishment, and workspace authentication.
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Active User: {user?.email || 'demo@reachinbox.ai'}
                </p>
              </div>
            </div>

            <div className="self-end sm:self-center">
              <span className="text-xs font-semibold text-slate-500">Authenticated</span>
            </div>
          </Card>
        )}

        {/* 2. Slack Integration */}
        {(filter === 'ALL' || filter === 'SLACK') && (
          <SlackConnectionCard isAuthenticated={isAuthenticated} />
        )}

        {/* 3. Ethereal SMTP */}
        {(filter === 'ALL' || filter === 'SMTP') && (
          <Card className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600 shadow-xs">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Ethereal Email SMTP</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nodemailer pooled SMTP transport delivering emails with preview URLs.
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Host: smtp.ethereal.email:587 • Pool: 5 connections
                </p>
              </div>
            </div>

            <div className="self-end sm:self-center">
              <a
                href="https://ethereal.email"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
              >
                <span>Ethereal Dashboard</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </Card>
        )}

        {/* 4. Elasticsearch */}
        {(filter === 'ALL' || filter === 'ELASTICSEARCH') && (
          <Card className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Elasticsearch 8.13</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-throughput search projection with automatic fallback to PostgreSQL.
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Node: http://localhost:9200 • Index: emails
                </p>
              </div>
            </div>

            <div className="self-end sm:self-center">
              <span className="text-xs font-semibold text-slate-600">Index Synced</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
