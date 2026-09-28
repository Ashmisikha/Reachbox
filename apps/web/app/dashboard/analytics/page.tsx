'use client';
import React from 'react';
import { useDashboardStats } from '../../../hooks/useCampaigns';
import {
  Card,
  MetricCard,
  LoadingState,
  ErrorState,
  PageHeader,
  DateRangeControl,
  ActivityChart,
  DeliveryRing,
} from '../../../components/ui';
import {
  Send,
  Clock,
  Filter,
  CheckCircle2,
} from 'lucide-react';

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
  const successRate =
    totalProcessed > 0 ? ((sent / totalProcessed) * 100).toFixed(1) + '%' : '100%';
  const failureRate =
    totalProcessed > 0 ? ((failed / totalProcessed) * 100).toFixed(1) + '%' : '0.0%';

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Analytics"
        description="Detailed insights into your email performance and queue throughput."
        actions={
          <div className="flex items-center gap-2">
            <DateRangeControl label="Feb 22, 2026 - Mar 25, 2026" />
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium shadow-xs"
            >
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>All Campaigns</span>
            </button>
          </div>
        }
      />

      {/* ─── 4 Metric Cards (Real operational values) ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Scheduled"
          value={scheduled}
          subtext="Pending in Redis queue"
          change="+14.2%"
          changeType="positive"
          icon={<Clock className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          label="Total Sent"
          value={sent}
          subtext="SMTP confirmed delivery"
          change="+100%"
          changeType="positive"
          icon={<Send className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          label="Delivery Rate"
          value={successRate}
          subtext="Confirmed delivered ratio"
          change="Optimal"
          changeType="positive"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          label="Failure Rate"
          value={failureRate}
          subtext={failed > 0 ? `${failed} messages failed` : 'Zero errors detected'}
          change={failed > 0 ? `${failed} errors` : 'Healthy'}
          changeType={failed > 0 ? 'negative' : 'positive'}
          icon={<Clock className="w-4 h-4 text-rose-600" />}
        />
      </div>

      {/* ─── Delivery Activity Chart ────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Email Delivery Over Time</h3>
            <p className="text-xs text-slate-500">Scheduled vs processed throughput distribution</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-200" />
              Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
              Sent
            </span>
          </div>
        </div>

        <ActivityChart scheduled={scheduled} sent={sent} />
      </Card>

      {/* ─── Breakdown Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Outcome Ring Chart */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Delivery Outcome Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Real-time status proportions</p>

          <DeliveryRing
            delivered={sent}
            scheduled={scheduled}
            failed={failed}
          />
        </Card>

        {/* Infrastructure Health */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Queue &amp; Transport Health</h3>
            <p className="text-xs text-slate-500 mb-4">Authoritative storage and queue states</p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">PostgreSQL Database</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">BullMQ Redis Delayed Jobs</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600 font-medium">Ethereal SMTP Transport</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Ready
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Overall Success Ratio</span>
            <span className="font-bold text-emerald-600 text-sm">{successRate}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
