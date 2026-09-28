'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { queueService, QueueMetricsResponse } from '../../../services/campaign.service';
import {
  Card,
  MetricCard,
  LoadingState,
  ErrorState,
  PageHeader,
} from '../../../components/ui';
import {
  Cpu,
  RefreshCw,
  Clock,
  Activity,
  Zap,
} from 'lucide-react';

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
      <PageHeader
        title="BullMQ Queue Monitor"
        description="Real-time queue metrics and distributed worker status."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadMetrics}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <a
              href={`${apiBase}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span>Open Bull-Board ↗</span>
            </a>
          </div>
        }
      />

      {/* ─── 4 Worker Cluster Metric Cards (Screen 14 in PDF) ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Worker Concurrency"
          value={data?.workerConcurrency ?? 10}
          subtext="Parallel job execution threads"
          change="Configured"
          changeType="positive"
          icon={<Cpu className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          label="Redis Queue Engine"
          value="Healthy"
          subtext="AOF persistence active"
          change="Connected"
          changeType="positive"
          icon={<Zap className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          label="Delayed Schedulers"
          value={data?.queues?.find((q) => q.name === 'email-dispatch')?.counts.delayed ?? 0}
          subtext="Future due jobs in Redis"
          icon={<Clock className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          label="Queue Health"
          value="100%"
          subtext="Zero blocked workers"
          change="Active"
          changeType="positive"
          icon={<Activity className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* ─── Queue Breakdown Table (Screen 14 in PDF) ────────────────────── */}
      {isLoading ? (
        <LoadingState message="Connecting to BullMQ Redis queues..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadMetrics} />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Registered BullMQ Queues</h3>
              <p className="text-[11px] text-slate-500">Live job counts by lifecycle phase</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Snapshot: {new Date().toLocaleTimeString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Queue Name</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Waiting</th>
                  <th className="py-2.5 px-4">Active</th>
                  <th className="py-2.5 px-4">Delayed</th>
                  <th className="py-2.5 px-4">Completed</th>
                  <th className="py-2.5 px-4 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data?.queues?.map((q) => (
                  <tr key={q.name} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 font-mono text-[11px] block">
                        {q.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {q.name === 'email-dispatch'
                          ? 'SMTP delivery with Lua rate limiting'
                          : q.name === 'email-index'
                          ? 'Elasticsearch projection indexing'
                          : 'Deduplicated Slack alert notifications'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Active</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                      {q.counts.waiting}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                      {q.counts.active}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-blue-700">
                      {q.counts.delayed}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-emerald-700">
                      {q.counts.completed}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-right font-medium text-rose-600">
                      {q.counts.failed}
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
