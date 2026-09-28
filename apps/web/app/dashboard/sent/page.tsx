'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { campaignService, SentEmail, PaginationMeta } from '../../../services/campaign.service';
import {
  Card,
  StatusBadge,
  Pagination,
  LoadingState,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../../components/ui';
import { Send, Search, RefreshCw, ExternalLink, Filter, Plus } from 'lucide-react';

export default function SentEmailsPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSent = useCallback(async (query: string, p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await campaignService.searchSent(query, p, 20);
      setEmails(data.emails);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load sent emails');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSent(activeQuery, page);
  }, [activeQuery, page, fetchSent]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveQuery(searchQuery);
  };

  return (
    <div className="space-y-5">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Sent Emails"
        description="View sent emails and their delivery status."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSent(activeQuery, page)}
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
              <span>New Campaign</span>
            </Link>
          </div>
        }
      />

      {/* ─── Search & Filters Bar ────────────────────────────────────────── */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sent emails via Elasticsearch..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
        >
          Search
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium shadow-xs"
        >
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter</span>
        </button>
      </form>

      {/* ─── Table Content ───────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Loading delivered emails..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchSent(activeQuery, page)} />
      ) : emails.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Send className="w-6 h-6 text-slate-400" />}
            title="No sent emails found"
            description={
              activeQuery
                ? `No emails match "${activeQuery}". Try another keyword.`
                : 'No emails have been delivered yet. When BullMQ workers dispatch jobs, delivered emails will be indexed here.'
            }
            action={
              <Link
                href="/dashboard/compose"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-xs"
              >
                <span>Schedule a Campaign</span>
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
                  <th className="py-2.5 px-4">Campaign / Subject</th>
                  <th className="py-2.5 px-4">Sent At</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Message ID</th>
                  <th className="py-2.5 px-4 text-right">Ethereal Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {emails.map((e) => (
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
                      {e.sentAt ? new Date(e.sentAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                      {e.messageId || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {e.previewUrl ? (
                        <a
                          href={e.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition-colors shadow-2xs"
                        >
                          <span>Preview</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-300 font-mono">Delivered</span>
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
