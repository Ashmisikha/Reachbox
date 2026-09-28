import React from 'react';
import { EMAIL_STATUSES } from '@reachinbox/shared';
import { AuthBoundary } from '../components/auth/AuthBoundary';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto">
      {/* Header Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium tracking-wide mb-6">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Phase 5: Real Google OAuth Active
      </div>

      {/* Main Title & Subtitle */}
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-center bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-4">
        ReachInbox Email Job Scheduler
      </h1>
      <p className="text-slate-400 text-center max-w-2xl text-base md:text-lg mb-8">
        Full-stack email scheduling platform with BullMQ delayed jobs, PostgreSQL persistence,
        Elasticsearch full-text search, and real Google OAuth 2.0 authentication.
      </p>

      {/* Authentication Boundary (Phase 5) */}
      <AuthBoundary />

      {/* Architecture Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-10">
        {/* API Backend Card */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Backend API
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ready
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Express.js + TypeScript</h2>
          <p className="text-sm text-slate-400 mb-3">
            Centralized error handling, typed configuration, and health check monitoring.
          </p>
          <div className="text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300">
            GET /health &rarr; 200 OK
          </div>
        </div>

        {/* Web Frontend Card */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Frontend Client
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ready
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Next.js 14 + Tailwind CSS</h2>
          <p className="text-sm text-slate-400 mb-3">
            React App Router with Tailwind CSS styling and shared monorepo types.
          </p>
          <div className="text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300">
            Port: 3000 (App Shell)
          </div>
        </div>

        {/* Shared Package Card */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Shared Library
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Compiled
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">@reachinbox/shared</h2>
          <p className="text-sm text-slate-400 mb-3">
            Type contracts, state definitions ({Object.values(EMAIL_STATUSES).join(', ')}), and
            standardized API schemas.
          </p>
          <div className="text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300">
            packages/shared &rarr; dist/index.d.ts
          </div>
        </div>

        {/* Infrastructure Card */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Infrastructure
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Configured
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">PostgreSQL 16 &amp; Redis 7</h2>
          <p className="text-sm text-slate-400 mb-3">
            Persistent volumes, isolated networking, and healthchecks via Docker Compose.
          </p>
          <div className="text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300">
            docker compose up -d
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-xs text-slate-500 text-center">
        ReachInbox Full-stack Engineering Assignment &bull; Phase 0 Foundation Verification
      </footer>
    </main>
  );
}
