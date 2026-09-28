'use client';
import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats, useCampaigns } from '../../hooks/useCampaigns';
import {
  MetricCard,
  Card,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  PageHeader,
  DateRangeControl,
  ActivityChart,
  DeliveryRing,
} from '../../components/ui';
import {
  Clock,
  Send,
  Layers,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    stats,
    isLoading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useDashboardStats();
  const {
    campaigns,
    isLoading: campaignsLoading,
    error: campaignsError,
    refresh: refreshCampaigns,
  } = useCampaigns(1, 6);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Demo';

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
  const deliveryRate =
    totalDelivered > 0 ? ((sent / totalDelivered) * 100).toFixed(1) + '%' : '100%';

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={`Good morning, ${firstName}!`}
        description="Track campaign performance, monitor queues, and manage your email infrastructure."
        actions={
          <div className="flex items-center gap-2.5">
            <DateRangeControl label="Feb 22, 2026 - Mar 02, 2026" />
            <Link
              href="/dashboard/compose"
              data-tour="action-new-campaign"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Campaign</span>
            </Link>
          </div>
        }
      />

      {/* ─── 4 Compact Metric Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Scheduled"
          value={scheduled}
          subtext="Queued in BullMQ"
          change="+12%"
          changeType="positive"
          icon={<Clock className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          label="Sent"
          value={sent}
          subtext="Delivered via SMTP"
          change="+100%"
          changeType="positive"
          icon={<Send className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          label="Delivery Rate"
          value={deliveryRate}
          subtext={failed > 0 ? `${failed} failed` : 'Zero errors detected'}
          change="Optimal"
          changeType="positive"
          icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          label="Active Campaigns"
          value={totalCampaigns}
          subtext="Configured workspaces"
          change={totalCampaigns > 0 ? 'Active' : 'Idle'}
          changeType={totalCampaigns > 0 ? 'positive' : 'neutral'}
          icon={<Layers className="w-4 h-4 text-slate-600" />}
        />
      </div>

      {/* ─── Email Activity & Delivery Status ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Email Activity (8 cols) */}
        <Card className="lg:col-span-8 p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Email Activity</h2>
              <p className="text-[11px] text-slate-500">Scheduled vs sent throughput over time</p>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
              Last 7 days
            </span>
          </div>

          <ActivityChart scheduled={scheduled} sent={sent} />
        </Card>

        {/* Delivery Status Ring (4 cols) */}
        <Card className="lg:col-span-4 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Delivery Status</h2>
            <p className="text-[11px] text-slate-500 mb-4">Live breakdown by outcome</p>
          </div>

          <div className="my-auto py-2">
            <DeliveryRing
              delivered={sent}
              scheduled={scheduled}
              failed={failed}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Overall Success</span>
            <span className="font-semibold text-emerald-600">{deliveryRate}</span>
          </div>
        </Card>
      </div>

      {/* ─── Recent Campaigns Table ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">Recent Campaigns</h3>
            <p className="text-[11px] text-slate-500">Latest scheduled and processed email batches</p>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns found"
            description="Get started by creating your first scheduled email campaign."
            action={
              <Link
                href="/dashboard/compose"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Campaign</span>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Campaign</th>
                  <th className="py-2.5 px-4">Recipients</th>
                  <th className="py-2.5 px-4">Delay</th>
                  <th className="py-2.5 px-4">Hourly Limit</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {campaigns.map((c) => {
                  const recipientCount =
                    c.messageCount ?? (c as any)._count?.messages ?? 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {c.subject}
                        </Link>
                        <p className="text-[11px] text-slate-400 font-normal">
                          From: {c.sender.email}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {recipientCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{c.delayMs}ms</td>
                      <td className="py-3 px-4 text-slate-500">{c.hourlyLimit}/hr</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Details &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
