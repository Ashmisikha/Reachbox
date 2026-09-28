'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useScheduledEmails } from '../../../hooks/useCampaigns';
import { Card, StatusBadge, Pagination, LoadingState, EmptyState, ErrorState } from '../../../components/ui';
import { Clock, Search, RefreshCw, Plus } from 'lucide-react';

export default function ScheduledEmailsPage() {
  const [page, setPage] = useState(1);
  const [filterQuery, setFilterQuery] = useState('');
  const { emails, pagination, isLoading, error, refresh } = useScheduledEmails(page, 25);

  const filteredEmails = emails.filter((e) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      e.recipient.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.sender.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scheduled Emails</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upcoming emails waiting in the BullMQ delayed jobs queue
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
            <span>Schedule Emails</span>
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
            placeholder="Filter by recipient, subject, sender..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Loading scheduled emails from queue..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : emails.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Clock className="w-6 h-6 text-slate-400" />}
            title="No scheduled emails"
            description="All scheduled email jobs have been dispatched or no campaigns are currently pending."
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
                  <th className="px-6 py-3">Recipient</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Sender</th>
                  <th className="px-6 py-3">Scheduled Time</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Campaign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900 font-mono text-xs">
                      {email.recipient}
                    </td>
                    <td className="px-6 py-3 text-slate-700 max-w-xs truncate font-medium">
                      {email.subject}
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs truncate max-w-[180px]">
                      {email.sender.name ? (
                        <span>
                          <span className="font-semibold text-slate-700">{email.sender.name}</span>{' '}
                          <span className="text-[11px] text-slate-400">({email.sender.email})</span>
                        </span>
                      ) : (
                        email.sender.email
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(email.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="px-6 py-3 text-slate-500 truncate max-w-[150px]">
                      <Link
                        href={`/dashboard/campaigns/${email.campaign.id}`}
                        className="text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {email.campaign.subject}
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
