'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCw,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { failureService } from '../../../services/failure.service';
import { FailureRecord } from '@reachinbox/shared';

export default function FailuresPage() {
  const [failures, setFailures] = useState<FailureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadFailures = useCallback(async () => {
    try {
      setLoading(true);
      const res = await failureService.list(search, page, 25);
      setFailures(res.failures);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to load failures', err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const retryableIds = failures.filter((f) => !f.isPermanent).map((f) => f.id);
    if (selectedIds.length === retryableIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(retryableIds);
    }
  };

  const handleRetrySingle = async (id: string) => {
    try {
      setRetryingId(id);
      setFeedback(null);
      await failureService.retrySingle(id);
      setFeedback('Email successfully scheduled for re-delivery via BullMQ.');
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      loadFailures();
    } catch (err: any) {
      alert(err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetrySelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkRetrying(true);
      setFeedback(null);
      const res = await failureService.retrySelected(selectedIds);
      setFeedback(`Successfully enqueued ${res.retriedCount} selected emails for retry.`);
      setSelectedIds([]);
      loadFailures();
    } catch (err: any) {
      alert(err.message || 'Bulk retry failed');
    } finally {
      setBulkRetrying(false);
    }
  };

  const handleRetryAll = async () => {
    if (!confirm('Are you sure you want to retry all eligible temporary failed emails?')) return;
    try {
      setBulkRetrying(true);
      setFeedback(null);
      const res = await failureService.retryAll();
      setFeedback(`Successfully enqueued ${res.retriedCount} eligible emails for retry.`);
      setSelectedIds([]);
      loadFailures();
    } catch (err: any) {
      alert(err.message || 'Retry all failed');
    } finally {
      setBulkRetrying(false);
    }
  };

  const retryableCount = failures.filter((f) => !f.isPermanent).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Failure & Retry Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect delivery failures, diagnose errors, and safely retry temporary errors via BullMQ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleRetrySelected}
              disabled={bulkRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-xs transition-colors"
            >
              {bulkRetrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              <span>Retry Selected ({selectedIds.length})</span>
            </button>
          )}
          <button
            onClick={handleRetryAll}
            disabled={bulkRetrying || retryableCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-xs transition-colors"
          >
            {bulkRetrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            <span>Retry All Eligible</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search failures by recipient, campaign, or error..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {failures.length} recorded failure{failures.length !== 1 ? 's' : ''} ({retryableCount} retryable)
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-xs font-medium">Loading failures...</span>
        </div>
      ) : failures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-slate-200 text-center px-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Zero Delivery Failures</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            All your scheduled campaigns have delivered cleanly with no persistent or temporary errors.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === retryableCount}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Campaign</th>
                  <th className="py-2.5 px-3">Sender</th>
                  <th className="py-2.5 px-3">Failure Reason</th>
                  <th className="py-2.5 px-3 text-center">Attempts</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {failures.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        disabled={f.isPermanent}
                        checked={selectedIds.includes(f.id)}
                        onChange={() => toggleSelect(f.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                      />
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">{f.recipient}</td>
                    <td className="py-3 px-3 text-slate-700 truncate max-w-[140px]" title={f.campaignName}>
                      {f.campaignName}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{f.senderEmail}</td>
                    <td className="py-3 px-3 max-w-[220px]">
                      <div className="font-mono text-[11px] text-red-600 truncate bg-red-50/70 px-1.5 py-0.5 rounded border border-red-100" title={f.error || ''}>
                        {f.error}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Last attempt: {f.lastAttemptAt ? new Date(f.lastAttemptAt).toLocaleTimeString() : 'N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-600">
                      {f.attempts}
                    </td>
                    <td className="py-3 px-3">
                      {f.isPermanent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <XCircle className="w-3 h-3 text-slate-500" />
                          Permanent (Hard)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-500" />
                          Temporary (Retryable)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleRetrySingle(f.id)}
                        disabled={f.isPermanent || retryingId === f.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-medium rounded shadow-2xs transition-colors"
                      >
                        {retryingId === f.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        ) : (
                          <RotateCw className="w-3 h-3 text-slate-500" />
                        )}
                        <span>Retry</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
