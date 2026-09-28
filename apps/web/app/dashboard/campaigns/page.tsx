'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useCampaigns } from '../../../hooks/useCampaigns';
import {
  Card,
  StatusBadge,
  Pagination,
  LoadingState,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../../components/ui';
import { Layers, Plus, Search, RefreshCw, Filter, ArrowRight } from 'lucide-react';

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'SCHEDULED' | 'SENDING' | 'COMPLETED'>('ALL');
  const { campaigns, pagination, isLoading, error, refresh } = useCampaigns(page, 15);

  const filteredCampaigns = campaigns.filter((c) => {
    // Tab filter
    if (activeTab === 'SCHEDULED' && c.status !== 'SCHEDULED') return false;
    if (activeTab === 'SENDING' && c.status !== 'PROCESSING') return false;
    if (activeTab === 'COMPLETED' && c.status !== 'COMPLETED') return false;

    // Search query filter
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return c.subject.toLowerCase().includes(q) || c.sender.email.toLowerCase().includes(q);
  });

  const scheduledCount = campaigns.filter((c) => c.status === 'SCHEDULED').length;
  const sendingCount = campaigns.filter((c) => c.status === 'PROCESSING').length;
  const completedCount = campaigns.filter((c) => c.status === 'COMPLETED').length;

  return (
    <div className="space-y-5">
      {/* ─── Page Header ────────────────────────────────────────────────── */}
      <PageHeader
        title="Campaigns"
        description="Create, manage and track your email campaigns."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
              title="Refresh campaigns"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <Link
              href="/dashboard/compose"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Campaign</span>
            </Link>
          </div>
        }
      />

      {/* ─── Tabs & Search Filter Bar ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg border border-slate-200/80 self-start">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab('SCHEDULED')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'SCHEDULED'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scheduled ({scheduledCount})
          </button>
          <button
            onClick={() => setActiveTab('SENDING')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'SENDING'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sending ({sendingCount})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'COMPLETED'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium shadow-xs"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* ─── Table Content ──────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Loading campaigns..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : filteredCampaigns.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Layers className="w-6 h-6 text-slate-400" />}
            title="No campaigns found"
            description={
              filterQuery
                ? 'No campaigns match your search criteria. Try a different query.'
                : "You haven't scheduled any email campaigns yet. Create your first campaign to begin."
            }
            action={
              <Link
                href="/dashboard/compose"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Campaign</span>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Campaign</th>
                  <th className="py-2.5 px-4">Recipients</th>
                  <th className="py-2.5 px-4">Scheduled</th>
                  <th className="py-2.5 px-4">Rate Limit</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCampaigns.map((c) => {
                  const recipientCount =
                    c.messageCount ?? (c as any)._count?.messages ?? 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors block"
                        >
                          {c.subject}
                        </Link>
                        <span className="text-[11px] text-slate-400">
                          Sender: {c.sender.email}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {recipientCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                        {new Date(c.startAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {c.hourlyLimit} / hr ({c.delayMs}ms delay)
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 1}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </Card>
      )}
    </div>
  );
}
