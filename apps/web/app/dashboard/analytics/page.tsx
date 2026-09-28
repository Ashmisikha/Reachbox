'use client';
import React from 'react';
import { useDashboardStats } from '../../../hooks/useCampaigns';
import { Card, StatCard, LoadingState, ErrorState } from '../../../components/ui';
import { BarChart3, Send, Clock, AlertTriangle, TrendingUp, ShieldCheck, Cpu, Database } from 'lucide-react';

export default function AnalyticsPage() {
  const { stats, isLoading, error, refresh } = useDashboardStats();

  if (isLoading) {
    return <LoadingState message="Loading campaign analytics..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const scheduled = stats?.scheduledCount ?? 0;
  const sent = stats?.sentCount ?? 0;
  const failed = stats?.failedCount ?? 0;
  const totalProcessed = sent + failed;
  const totalVolume = scheduled + sent + failed;
  const successRate = totalProcessed > 0 ? ((sent / totalProcessed) * 100).toFixed(1) + '%' : '100%';

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campaign Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational email throughput, delivery rates, and queue health
          </p>
        </div>
      </div>

      {/* ─── Metric KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sent"
          value={sent.toLocaleString()}
          subtext="Dispatched via SMTP"
          icon={<Send className="w-4 h-4 text-emerald-600" />}
        />
        <StatCard
          label="Scheduled Queue"
          value={scheduled.toLocaleString()}
          subtext="Waiting in BullMQ"
          icon={<Clock className="w-4 h-4 text-blue-600" />}
        />
        <StatCard
          label="Failed Deliveries"
          value={failed.toLocaleString()}
          subtext={failed === 0 ? 'Zero failures' : 'Requires review'}
          icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
        />
        <StatCard
          label="Delivery Success Rate"
          value={successRate}
          subtext="Sent vs failed ratio"
          icon={<TrendingUp className="w-4 h-4 text-teal-600" />}
        />
      </div>

      {/* ─── Detailed Analytics Breakdown ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Message State Distribution</h2>
            <span className="text-xs text-slate-400 font-mono">Total: {totalVolume.toLocaleString()}</span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Delivered (Sent)</span>
                <span className="font-semibold text-emerald-600">{sent} ({totalVolume > 0 ? ((sent / totalVolume) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${totalVolume > 0 ? (sent / totalVolume) * 100 : 0}%` }}
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Pending (Scheduled)</span>
                <span className="font-semibold text-blue-600">{scheduled} ({totalVolume > 0 ? ((scheduled / totalVolume) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${totalVolume > 0 ? (scheduled / totalVolume) * 100 : 0}%` }}
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Failed</span>
                <span className="font-semibold text-rose-500">{failed} ({totalVolume > 0 ? ((failed / totalVolume) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${totalVolume > 0 ? (failed / totalVolume) * 100 : 0}%` }}
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Infrastructure & Engine Status */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Engine Architecture Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span>BullMQ Workers</span>
              </div>
              <p className="text-[11px] text-slate-500">Concurrency: 5 • Delayed jobs</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Redis Rate Limiter</span>
              </div>
              <p className="text-[11px] text-slate-500">Sliding token bucket • Atomic</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>PostgreSQL DB</span>
              </div>
              <p className="text-[11px] text-slate-500">Source of truth • Idempotent</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                <span>Elasticsearch Index</span>
              </div>
              <p className="text-[11px] text-slate-500">Real-time search projection</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
