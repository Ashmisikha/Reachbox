'use client';
import React, { useState } from 'react';
import { useSenders } from '../../../hooks/useCampaigns';
import { senderService } from '../../../services/campaign.service';
import { Card, StatusBadge, LoadingState, EmptyState, ErrorState } from '../../../components/ui';
import { Users, Plus, RefreshCw } from 'lucide-react';

export default function SendersPage() {
  const { senders, isLoading, error, refresh } = useSenders();

  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await senderService.create({ email: email.trim(), name: name.trim() || undefined });
      await refresh();
      setShowAddModal(false);
      setEmail('');
      setName('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to add sender account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sender Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage authenticated email senders for your scheduling campaigns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
            title="Refresh senders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Sender</span>
          </button>
        </div>
      </div>

      {/* ─── Add Sender Modal ────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Connect Sender Account</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSender} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sender Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="marketing@reachinbox.ai"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ReachInbox Growth"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {formError && <p className="text-xs text-rose-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Connect'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Loading sender accounts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : senders.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Users className="w-6 h-6 text-slate-400" />}
            title="No sender accounts"
            description="You need at least one connected email sender to schedule campaigns."
            action={
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Connect First Sender</span>
              </button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Display Name</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Connected Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {senders.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      {s.name || '—'}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-700">
                      {s.email}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
