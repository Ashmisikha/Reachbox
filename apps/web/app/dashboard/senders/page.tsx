'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { senderService } from '../../../services/campaign.service';
import { SenderHealthMetrics } from '@reachinbox/shared';
import {
  Card,
  LoadingState,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../../components/ui';
import {
  Users,
  Plus,
  RotateCw,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderHealthMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSenders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await senderService.getHealth();
      setSenders(res.senders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sender health metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSenders();
  }, [loadSenders]);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await senderService.create({ email: email.trim(), name: name.trim() || undefined });
      await loadSenders();
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
      {/* Header */}
      <PageHeader
        title="Sender Health &amp; Operations"
        description="Live operational telemetry, atomic hourly capacity tracking, and rate-limit states across distributed workers."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadSenders}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
              title="Refresh sender metrics"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sender</span>
            </button>
          </div>
        }
      />

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Querying live Redis rate-limit and PostgreSQL counters..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSenders} />
      ) : senders.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Users className="w-6 h-6 text-slate-400" />}
            title="No senders configured"
            description="Add an authorized email sender to bind with your campaigns and enforce hourly limits."
            action={
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Sender</span>
              </button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {senders.map((s) => {
              const usagePercent = Math.min(100, Math.round((s.sentThisHour / (s.hourlyLimit || 1)) * 100));
              const isHealthy = s.status === 'ACTIVE';
              const isRateLimited = s.status === 'RATE_LIMITED';

              return (
                <div
                  key={s.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 truncate" title={s.email}>
                          {s.email}
                        </h3>
                        <span className="text-[11px] text-slate-500">{s.name}</span>
                      </div>
                      <div>
                        {isHealthy ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Healthy
                          </span>
                        ) : isRateLimited ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Rate Limited
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {s.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hourly Capacity Bar */}
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Hourly Capacity</span>
                        <span className="font-mono text-slate-900 font-semibold">
                          {s.sentThisHour} / {s.hourlyLimit} sent
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${usagePercent}%` }}
                          className={`h-full transition-all duration-300 ${
                            usagePercent >= 90 ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Remaining: {s.remainingCapacity} slots</span>
                        <span>{100 - usagePercent}% window remaining</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Failed Sends</span>
                      <span className="font-bold text-slate-800">{s.failedCount}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Rate-Limit Hits</span>
                      <span className="font-bold text-slate-800">{s.rateLimitEventsCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Add New Sender Account</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSender} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sender Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sales@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sender Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Add Sender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
