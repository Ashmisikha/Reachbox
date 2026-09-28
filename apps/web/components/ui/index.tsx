'use client';
import React from 'react';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED:   'bg-blue-50 text-blue-700 border-blue-200/80',
  PROCESSING:  'bg-amber-50 text-amber-700 border-amber-200/80',
  SENT:        'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  COMPLETED:   'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  ACTIVE:      'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  VALID:       'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  FAILED:      'bg-rose-50 text-rose-700 border-rose-200/80',
  CANCELLED:   'bg-slate-100 text-slate-600 border-slate-200',
  DRAFT:       'bg-slate-100 text-slate-600 border-slate-200',
  INACTIVE:    'bg-slate-100 text-slate-500 border-slate-200',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status.toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-8 h-8 border-3' : 'w-5 h-5 border-2';
  return (
    <div className={`${sz} border-blue-600 border-t-transparent rounded-full animate-spin shrink-0 ${className}`} />
  );
}

// ─── LoadingState ──────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner size="lg" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-1">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── ErrorState ────────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 text-xl font-bold">
        !
      </div>
      <p className="text-sm font-medium text-slate-800">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 text-xs px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium transition-colors shadow-sm"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200/90 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs text-slate-500 bg-white">
      <span>
        Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalPages}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shadow-xs"
        >
          &larr; Previous
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shadow-xs"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  subtext,
  icon,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1 font-medium">{subtext}</p>}
    </div>
  );
}
