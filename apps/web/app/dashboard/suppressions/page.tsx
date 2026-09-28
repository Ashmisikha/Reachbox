'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { suppressionService } from '../../../services/suppression.service';
import { Suppression } from '@reachinbox/shared';

export default function SuppressionsPage() {
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Add modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('Unsubscribed via opt-out request');
  const [saving, setSaving] = useState(false);

  const loadSuppressions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await suppressionService.list(search, page, 25);
      setSuppressions(res.suppressions);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppressions');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadSuppressions();
  }, [loadSuppressions]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setSaving(true);
      await suppressionService.add({ email, reason });
      setIsAddOpen(false);
      setEmail('');
      loadSuppressions();
    } catch (err: any) {
      alert(err.message || 'Failed to add suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string, emailAddr: string) => {
    if (!confirm(`Are you sure you want to remove ${emailAddr} from the suppression list?`)) return;
    try {
      await suppressionService.remove(id);
      loadSuppressions();
    } catch (err: any) {
      alert(err.message || 'Failed to remove suppression');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Suppression List</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Addresses blocked from receiving emails. The server worker verifies suppression before every send.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Suppression</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search suppressed emails or reasons..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {suppressions.length} suppressed recipient{suppressions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
          {error}
        </div>
      )}

      {/* Suppression Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-xs font-medium">Loading suppression list...</span>
        </div>
      ) : suppressions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-dashed border-slate-300 text-center px-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No suppressions found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {search
              ? 'No suppressed recipients match your search.'
              : 'Add email addresses that should never receive outreach campaigns or follow-up sequence steps.'}
          </p>
          {!search && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Suppressed Email</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4">Date Added</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppressions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      {s.email}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {s.reason || 'Manual suppression'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString()} at{' '}
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRemove(s.id, s.email)}
                        title="Remove suppression"
                        className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
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

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Add Email to Suppression List</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Suppression Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Unsubscribed via opt-out request">Unsubscribed via opt-out request</option>
                  <option value="Manual suppression / Do not contact">Manual suppression / Do not contact</option>
                  <option value="Hard bounce / Invalid mailbox">Hard bounce / Invalid mailbox</option>
                  <option value="Spam complaint">Spam complaint</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-xs transition-colors"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Suppression</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
