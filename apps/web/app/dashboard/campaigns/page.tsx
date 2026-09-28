'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useCampaigns } from '../../../hooks/useCampaigns';
import { Card, StatusBadge, Pagination, LoadingState, EmptyState, ErrorState } from '../../../components/ui';
import { Layers, Plus, Search, RefreshCw, ArrowRight } from 'lucide-react';

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [filterQuery, setFilterQuery] = useState('');
  const { campaigns, pagination, isLoading, error, refresh } = useCampaigns(page, 20);

  const filteredCampaigns = campaigns.filter((c) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return c.subject.toLowerCase().includes(q) || c.sender.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your email campaigns, dispatch schedules, and delivery progress
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/dashboard/compose"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search campaigns by name or sender..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* ─── Table Content ───────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Loading campaigns..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : campaigns.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Layers className="w-6 h-6 text-slate-400" />}
            title="No campaigns yet"
            description="You haven't scheduled any email campaigns yet. Create your first campaign to begin."
            action={
              <Link
                href="/dashboard/compose"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Campaign</span>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Campaign Subject</th>
                  <th className="px-6 py-3">Sender</th>
                  <th className="px-6 py-3">Recipients</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created Date</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-900 max-w-xs truncate">
                      <Link
                        href={`/dashboard/campaigns/${c.id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {c.subject}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-600 truncate max-w-[180px]">
                      {c.sender.name ? (
                        <span>
                          <span className="font-semibold text-slate-700">{c.sender.name}</span>{' '}
                          <span className="text-[11px] text-slate-400">({c.sender.email})</span>
                        </span>
                      ) : (
                        c.sender.email
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-700 font-medium">
                      {c.messageCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/dashboard/campaigns/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            />
          )}
        </Card>
      )}
    </div>
  );
}
