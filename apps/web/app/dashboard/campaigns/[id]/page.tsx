'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { campaignService, Campaign } from '../../../../services/campaign.service';
import { Card, StatCard, StatusBadge, LoadingState, ErrorState } from '../../../../components/ui';
import { ArrowLeft, Clock, Send, Users, Layers, ShieldCheck } from 'lucide-react';

export default function CampaignDetailsPage() {
  const params = useParams();
  const campaignId = params?.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    setIsLoading(true);
    setError(null);
    campaignService
      .get(campaignId)
      .then((res) => setCampaign(res.campaign))
      .catch((err) => setError(err.message || 'Failed to load campaign'))
      .finally(() => setIsLoading(false));
  }, [campaignId]);

  if (isLoading) {
    return <LoadingState message="Loading campaign details..." />;
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </Link>
        <ErrorState message={error || 'Campaign not found'} />
      </div>
    );
  }

  const messageCount = campaign.messageCount ?? (campaign as any)._count?.messages ?? 0;

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{campaign.subject}</h1>
            <StatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      {/* ─── Metric KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Recipients"
          value={messageCount.toLocaleString()}
          subtext="Configured targets"
          icon={<Users className="w-4 h-4 text-blue-600" />}
        />
        <StatCard
          label="Per-Email Delay"
          value={`${campaign.delayMs} ms`}
          subtext={`${(campaign.delayMs / 1000).toFixed(1)}s between sends`}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
        />
        <StatCard
          label="Hourly Rate Limit"
          value={`${campaign.hourlyLimit} / hr`}
          subtext="Redis token bucket"
          icon={<ShieldCheck className="w-4 h-4 text-indigo-600" />}
        />
        <StatCard
          label="Queue Engine"
          value="BullMQ"
          subtext="Persistent delayed jobs"
          icon={<Layers className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* ─── Campaign Details Panels ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Campaign Configuration (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Campaign Specifications
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Campaign ID:</span>
                <p className="font-mono text-slate-700 text-[11px] truncate mt-0.5">{campaign.id}</p>
              </div>
              <div>
                <span className="text-slate-400">Sender Account:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {campaign.sender.name ? `${campaign.sender.name} (${campaign.sender.email})` : campaign.sender.email}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Scheduled Start Time:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {new Date(campaign.startAt).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Created Date:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {new Date(campaign.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Quick Links (1 col) */}
        <div>
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Queue & Delivery Status
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Jobs are queued with BullMQ delayed timestamps and dispatched through the Ethereal SMTP transport with distributed Redis rate limiting.
            </p>
            <div className="pt-2 space-y-2">
              <Link
                href="/dashboard/scheduled"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>View Scheduled Queue</span>
              </Link>
              <Link
                href="/dashboard/sent"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>View Sent Emails</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
