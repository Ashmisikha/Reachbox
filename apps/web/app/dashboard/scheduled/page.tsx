'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useScheduledEmails } from '../../../hooks/useCampaigns';
import {
  Card,
  StatusBadge,
  Pagination,
  LoadingState,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../../components/ui';
import { Clock, Search, RefreshCw, Plus, Filter } from 'lucide-react';

export default function ScheduledEmailsPage() {
  const [page, setPage] = useState(1);
  const [filterQuery, setFilterQuery] = useState('');
  const { emails, pagination, isLoading, error, refresh } = useScheduledEmails(page, 20);

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
    <div className="space-y-5">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Scheduled Emails"
        description="View and manage upcoming email dispatches."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
              title="Refresh list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <Link
              href="/dashboard/compose"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Schedule Emails</span>
            </Link>
          </div>
        }
      />

      {/* ─── Search & Filters Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search scheduled emails by recipient, subject..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
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

      {/* ─── Table Content ───────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Loading scheduled queue..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : filteredEmails.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Clock className="w-6 h-6 text-slate-400" />}
            title="No scheduled emails in queue"
            description={
              filterQuery
                ? 'No scheduled messages match your search.'
                : 'There are currently no upcoming delayed jobs in Redis. Schedule a campaign to queue emails.'
            }
            action={
              <Link
                href="/dashboard/compose"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Campaign</span>
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
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Campaign</th>
                  <th className="py-2.5 px-4">Scheduled At</th>
                  <th className="py-2.5 px-4">Sender</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Job Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmails.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 font-mono text-[11px]">
                      {e.recipient}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 line-clamp-1">
                        {e.campaign?.subject ?? e.subject}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(e.scheduledAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {e.sender.email}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {e.campaign?.id && (
                        <Link
                          href={`/dashboard/campaigns/${e.campaign.id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Campaign &rarr;
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
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
