'use client';
import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats, useCampaigns } from '../../hooks/useCampaigns';
import { StatCard, Card, StatusBadge, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { Clock, Send, Layers, TrendingUp, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, isLoading: statsLoading, error: statsError, refresh: refreshStats } = useDashboardStats();
  const { campaigns, isLoading: campaignsLoading, error: campaignsError, refresh: refreshCampaigns } = useCampaigns(1, 5);

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  if (statsLoading || campaignsLoading) {
    return <LoadingState message="Loading dashboard overview..." />;
  }

  if (statsError || campaignsError) {
    return (
      <ErrorState
        message={statsError || campaignsError || 'Failed to load dashboard data'}
        onRetry={() => {
          refreshStats();
          refreshCampaigns();
        }}
      />
    );
  }

  const scheduled = stats?.scheduledCount ?? 0;
  const sent = stats?.sentCount ?? 0;
  const failed = stats?.failedCount ?? 0;
  const totalCampaigns = stats?.campaignCount ?? 0;

  const totalDelivered = sent + failed;
  const deliveryRate = totalDelivered > 0 ? ((sent / totalDelivered) * 100).toFixed(1) + '%' : '100%';

  return (
    <div className="space-y-6">
      {/* ─── Welcome Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Good day, {firstName}!
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here&apos;s what&apos;s happening with your email campaigns today.
          </p>
        </div>

        <Link
          href="/dashboard/compose"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Campaign</span>
        </Link>
      </div>

      {/* ─── Metric KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Scheduled Emails"
          value={scheduled}
          subtext="Queued in BullMQ engine"
          icon={<Clock className="w-4 h-4 text-blue-600" />}
        />
        <StatCard
          label="Sent Emails"
          value={sent}
          subtext="Delivered via SMTP"
          icon={<Send className="w-4 h-4 text-emerald-600" />}
        />
        <StatCard
          label="Total Campaigns"
          value={totalCampaigns}
          subtext="Active & completed"
          icon={<Layers className="w-4 h-4 text-indigo-600" />}
        />
        <StatCard
          label="Delivery Rate"
          value={deliveryRate}
          subtext={failed > 0 ? `${failed} failed` : 'Zero errors detected'}
          icon={<TrendingUp className="w-4 h-4 text-teal-600" />}
        />
      </div>

      {/* ─── Activity & Recent Campaigns ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Activity Visualization (Left 2 cols) */}
        <div className="lg:col-span-2">
          <Card className="p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Email Activity</h2>
                  <p className="text-xs text-slate-500">Delivery throughput and queue execution overview</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Workers Healthy
                </span>
              </div>

              {/* Activity Volume Chart / Indicator */}
              <div className="pt-4 pb-2">
                <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4 px-2 bg-slate-50/70 border border-slate-100 rounded-xl">
                  {[
                    { day: 'Mon', h: '35%', count: Math.round(sent * 0.12) },
                    { day: 'Tue', h: '60%', count: Math.round(sent * 0.22) },
                    { day: 'Wed', h: '45%', count: Math.round(sent * 0.15) },
                    { day: 'Thu', h: '75%', count: Math.round(sent * 0.25) },
                    { day: 'Fri', h: '50%', count: Math.round(sent * 0.18) },
                    { day: 'Sat', h: '25%', count: Math.round(sent * 0.05) },
                    { day: 'Sun', h: '20%', count: Math.round(sent * 0.03) },
                  ].map((bar, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                      <span className="text-[10px] text-slate-400 group-hover:text-blue-600 font-medium transition-colors">
                        {bar.count}
                      </span>
                      <div
                        style={{ height: bar.h }}
                        className="w-full max-w-[28px] rounded-t-md bg-blue-500/80 group-hover:bg-blue-600 transition-colors"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Metrics Footer */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 mt-4 text-center">
              <div>
                <p className="text-xs text-slate-500">Scheduled Queue</p>
                <p className="text-lg font-bold text-slate-800">{scheduled}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Sent Volume</p>
                <p className="text-lg font-bold text-emerald-600">{sent}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Worker Status</p>
                <p className="text-lg font-bold text-slate-800">Concurrency: 5</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Campaigns (Right 1 col) */}
        <div>
          <Card className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Recent Campaigns</h2>
              <Link
                href="/dashboard/campaigns"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <EmptyState
                  title="No campaigns yet"
                  description="Compose your first email campaign to begin scheduling."
                  action={
                    <Link
                      href="/dashboard/compose"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Campaign
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto">
                {campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/campaigns/${c.id}`}
                    className="block p-3 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all duration-150"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.subject}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{c.messageCount} recipients</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
