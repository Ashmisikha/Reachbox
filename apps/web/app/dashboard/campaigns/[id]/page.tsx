'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { campaignService, Campaign } from '../../../../services/campaign.service';
import {
  StatusBadge,
  LoadingState,
  ErrorState,
  PageHeader,
} from '../../../../components/ui';
import {
  ArrowLeft,
  RotateCw,
  Ban,
  CheckCircle2,
  Activity,
  Loader2,
} from 'lucide-react';

export default function CampaignDetailsPage() {
  const params = useParams();
  const campaignId = params?.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ACTIVITY' | 'STEPS' | 'SETTINGS'>('OVERVIEW');

  const loadCampaign = useCallback(() => {
    if (!campaignId) return;
    setIsLoading(true);
    setError(null);
    campaignService
      .get(campaignId)
      .then((res) => setCampaign(res.campaign))
      .catch((err) => setError(err.message || 'Failed to load campaign'))
      .finally(() => setIsLoading(false));
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  const handleCancel = async () => {
    if (!campaign) return;
    if (!confirm('Are you sure you want to cancel this campaign? All pending jobs and future follow-up steps will be cancelled.')) return;

    try {
      setCancelling(true);
      await campaignService.cancel(campaign.id);
      loadCampaign();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel campaign');
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading campaign operational analytics..." />;
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </Link>
        <ErrorState message={error || 'Campaign not found'} />
      </div>
    );
  }

  const analytics = campaign.analytics || {
    totalRecipients: campaign.messageCount || 0,
    scheduled: 0,
    waiting: 0,
    delayed: 0,
    active: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    suppressed: 0,
    completionRate: 0,
    deliveryRate: 0,
    failureRate: 0,
    failureBreakdown: {},
  };

  const isCancellable = campaign.status === 'SCHEDULED' || campaign.status === 'PROCESSING' || campaign.status === 'DRAFT';

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Campaigns</span>
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={campaign.subject}
        badge={<StatusBadge status={campaign.status} />}
        description={`Sender: ${campaign.sender.name ? `${campaign.sender.name} (${campaign.sender.email})` : campaign.sender.email} • Scheduled for ${new Date(campaign.startAt).toLocaleString()}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadCampaign}
              title="Refresh Analytics"
              className="p-1.5 text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-md transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            {isCancellable && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>Cancel Campaign</span>
              </button>
            )}
          </div>
        }
      />

      {/* Real Operational Progress Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Operational Campaign Progress</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
            <span>Completion: <strong className="text-slate-900">{analytics.completionRate}%</strong></span>
            <span>Delivery: <strong className="text-emerald-600">{analytics.deliveryRate}%</strong></span>
            {analytics.failureRate > 0 && (
              <span>Failure: <strong className="text-red-600">{analytics.failureRate}%</strong></span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${(analytics.sent / (analytics.totalRecipients || 1)) * 100}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Sent: ${analytics.sent}`}
          />
          <div
            style={{ width: `${(analytics.active / (analytics.totalRecipients || 1)) * 100}%` }}
            className="bg-blue-500 transition-all duration-500"
            title={`Active: ${analytics.active}`}
          />
          <div
            style={{ width: `${(analytics.failed / (analytics.totalRecipients || 1)) * 100}%` }}
            className="bg-red-500 transition-all duration-500"
            title={`Failed: ${analytics.failed}`}
          />
          <div
            style={{ width: `${(analytics.suppressed / (analytics.totalRecipients || 1)) * 100}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Suppressed: ${analytics.suppressed}`}
          />
          <div
            style={{ width: `${(analytics.cancelled / (analytics.totalRecipients || 1)) * 100}%` }}
            className="bg-slate-400 transition-all duration-500"
            title={`Cancelled: ${analytics.cancelled}`}
          />
        </div>

        <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sent ({analytics.sent})</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> In Flight ({analytics.active})</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-200"></span> Scheduled / Delayed ({analytics.scheduled})</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Failed ({analytics.failed})</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Suppressed ({analytics.suppressed})</span>
          {analytics.cancelled > 0 && (
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Cancelled ({analytics.cancelled})</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-3 py-2 font-semibold border-b-2 transition-colors ${
            activeTab === 'OVERVIEW'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Operational Metrics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVITY')}
          className={`px-3 py-2 font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
            activeTab === 'ACTIVITY'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Activity Timeline</span>
          {campaign.events && campaign.events.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px]">
              {campaign.events.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('STEPS')}
          className={`px-3 py-2 font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
            activeTab === 'STEPS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Sequence Steps</span>
          {campaign.steps && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px]">
              {campaign.steps.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Operational Metrics */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Messages
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {analytics.totalRecipients.toLocaleString()}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
                Delivered
              </span>
              <span className="text-xl font-bold text-emerald-600 mt-1 block">
                {analytics.sent.toLocaleString()}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                Pending / Delayed
              </span>
              <span className="text-xl font-bold text-blue-600 mt-1 block">
                {analytics.scheduled.toLocaleString()}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider block">
                Failed
              </span>
              <span className="text-xl font-bold text-red-600 mt-1 block">
                {analytics.failed.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Delivery Configuration Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Delivery Policy &amp; Throttling
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Inter-Email Spacing</span>
                  <span className="font-mono text-slate-800">{campaign.delayMs / 1000}s ({campaign.delayMs} ms)</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Hourly Rate Limit</span>
                  <span className="font-mono text-slate-800">{campaign.hourlyLimit} emails / hour</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Scheduled At</span>
                  <span className="font-mono text-slate-800">{new Date(campaign.startAt).toLocaleString()}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Created At</span>
                  <span className="font-mono text-slate-800">{new Date(campaign.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Failure Breakdown Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Failure Breakdown</span>
                {analytics.failed > 0 && (
                  <Link href="/dashboard/failures" className="text-blue-600 font-medium hover:underline text-[11px]">
                    Go to Retry Center &rarr;
                  </Link>
                )}
              </h3>
              {Object.keys(analytics.failureBreakdown || {}).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  No errors or failures reported for this campaign.
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(analytics.failureBreakdown || {}).map(([err, count]) => (
                    <div key={err} className="p-2 bg-red-50 border border-red-100 rounded text-xs flex justify-between items-center">
                      <span className="font-mono text-red-700 truncate max-w-xs">{err}</span>
                      <span className="font-bold text-red-800 px-1.5 py-0.5 rounded bg-red-100 text-[10px]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Activity Timeline */}
      {activeTab === 'ACTIVITY' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Campaign Audit &amp; Event Stream
          </h3>

          {!campaign.events || campaign.events.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No operational events recorded yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {campaign.events.map((evt) => {
                let badgeColor = 'bg-blue-600';
                if (evt.type === 'EMAIL_SENT' || evt.type === 'CAMPAIGN_COMPLETED') badgeColor = 'bg-emerald-600';
                if (evt.type === 'RATE_LIMIT_REACHED' || evt.type === 'RECIPIENT_SUPPRESSED') badgeColor = 'bg-amber-500';
                if (evt.type === 'SEND_FAILED') badgeColor = 'bg-red-600';
                if (evt.type === 'CAMPAIGN_CANCELLED') badgeColor = 'bg-slate-600';

                return (
                  <div key={evt.id} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${badgeColor}`}
                    />
                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{evt.type}</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(evt.createdAt).toLocaleTimeString()} ({new Date(evt.createdAt).toLocaleDateString()})
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{evt.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Sequence Steps */}
      {activeTab === 'STEPS' && (
        <div className="space-y-4">
          {!campaign.steps || campaign.steps.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-xs text-slate-400">
              No additional sequence steps configured. Single-stage outreach.
            </div>
          ) : (
            campaign.steps.map((st) => (
              <div key={st.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {st.stepOrder}
                    </div>
                    <span className="text-xs font-semibold text-slate-900">
                      Step {st.stepOrder} {st.stepOrder === 1 ? '(Initial Outreach)' : `(+${st.delayDays}d ${st.delayHours}h)`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Delay: {st.delayDays} day(s), {st.delayHours} hour(s)
                  </span>
                </div>
                <div className="pt-2 text-xs font-medium text-slate-800">
                  <span className="text-slate-400 font-normal">Subject: </span>
                  {st.subject}
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100 font-mono">
                  {st.body}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
