'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { queueService, QueueMetricsResponse } from '../../../services/campaign.service';
import { Card, LoadingState, ErrorState } from '../../../components/ui';
import { Cpu, RefreshCw, Layers, ExternalLink, CheckCircle2, Clock, Send, AlertTriangle } from 'lucide-react';

export default function QueuesDashboardPage() {
  const [data, setData] = useState<QueueMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await queueService.getMetrics();
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load queue metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BullMQ Live Queue Monitor</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time inspection of distributed BullMQ Redis queues, worker concurrency, and job states
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMetrics}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <a
            href={`${apiBase}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <span>Open Bull-Board Admin</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ─── Worker Concurrency Banner ───────────────────────────────────── */}
      <Card className="p-5 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30 border-blue-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Email Worker Cluster</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configured Concurrency: <span className="font-semibold text-slate-800">{data?.workerConcurrency ?? 5} parallel workers</span> • Persistence: Redis BullMQ delayed sets
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono text-right hidden sm:block">
            Snapshot: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}
          </div>
        </div>
      </Card>

      {/* ─── Queue Cards ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Connecting to BullMQ Redis queues..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadMetrics} />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data?.queues.map((q) => (
            <Card key={q.name} className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{q.displayName}</h2>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {q.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{q.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      q.isPaused
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {q.isPaused ? 'Paused' : 'Active'}
                  </span>
                </div>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                {/* Delayed */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-blue-50/30">
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Delayed</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{q.counts.delayed}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Scheduled for future</p>
                </div>

                {/* Waiting */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-1">
                    <span>Waiting</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{q.counts.waiting}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Ready for pickup</p>
                </div>

                {/* Active */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-amber-50/30">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold mb-1">
                    <span>Active</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{q.counts.active}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">In flight by worker</p>
                </div>

                {/* Completed */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-emerald-50/30">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mb-1">
                    <Send className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{q.counts.completed}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Successfully executed</p>
                </div>

                {/* Failed */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-rose-50/30">
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{q.counts.failed}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Exhausted retries</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
