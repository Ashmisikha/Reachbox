'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, AlertCircle, RefreshCw, Check } from 'lucide-react';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  SCHEDULED:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  PROCESSING:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  SENDING:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  SENT:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  DELIVERED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  COMPLETED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  ACTIVE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  FAILED:        { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  CANCELLED:     { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  DRAFT:         { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  INACTIVE:      { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  ARCHIVED:      { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  UNSUBSCRIBED:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  BOUNCED:       { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const norm = (status || '').toUpperCase();
  const fallback = { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
  const style = (STATUS_STYLES[norm] as typeof fallback) || fallback;

  // Format display text nicely (e.g. "SCHEDULED" -> "Scheduled")
  const displayText = norm ? norm.charAt(0) + norm.slice(1).toLowerCase() : 'Unknown';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{displayText}</span>
    </span>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  subtext,
  change,
  changeType = 'positive',
  icon,
  className = '',
}: {
  label: string;
  value: number | string;
  subtext?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 rounded-lg bg-white border border-slate-200 shadow-xs ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 tracking-tight">{label}</span>
        {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {change && (
          <span
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
              changeType === 'positive'
                ? 'bg-emerald-50 text-emerald-700'
                : changeType === 'negative'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-slate-400 mt-1 font-normal">{subtext}</p>}
    </div>
  );
}

// Backward compatible export for StatCard
export const StatCard = MetricCard;

// ─── Card ──────────────────────────────────────────────────────────────────────
export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg bg-white border border-slate-200 shadow-xs ${className}`}>
      {children}
    </div>
  );
}

// ─── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">{actions}</div>}
    </div>
  );
}

// ─── DateRangeControl ──────────────────────────────────────────────────────────
export function DateRangeControl({
  label: defaultLabel = 'Feb 22, 2026 - Mar 25, 2026',
  onChange,
}: {
  label?: string;
  onChange?: (range: { label: string; start?: string; end?: string }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);
  const [customStart, setCustomStart] = useState('2026-02-22');
  const [customEnd, setCustomEnd] = useState('2026-03-25');
  const containerRef = useRef<HTMLDivElement>(null);

  const presets = [
    { label: 'Today', subtext: 'Today so far' },
    { label: 'Yesterday', subtext: 'Past 24 hours' },
    { label: 'Last 7 days', subtext: 'Previous 7 days' },
    { label: 'Last 30 days', subtext: 'Feb 22, 2026 - Mar 25, 2026' },
    { label: 'This Month', subtext: 'Month-to-date' },
    { label: 'Last 90 days', subtext: 'Previous quarter' },
    { label: 'All time', subtext: 'Lifetime history' },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectPreset = (preset: { label: string; subtext: string }) => {
    const display = preset.label === 'Last 30 days' ? preset.subtext : preset.label;
    setSelectedLabel(display);
    setIsOpen(false);
    onChange?.({ label: display });
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      const formatDate = (d: string) => {
        const parts = d.split('-');
        if (parts.length === 3) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const m = months[parseInt(parts[1] || '1', 10) - 1];
          return `${m} ${parts[2]}, ${parts[0]}`;
        }
        return d;
      };
      const formatted = `${formatDate(customStart)} - ${formatDate(customEnd)}`;
      setSelectedLabel(formatted);
      setIsOpen(false);
      onChange?.({ label: formatted, start: customStart, end: customEnd });
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-xs"
        aria-expanded={isOpen}
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Select Date Range</p>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">UTC</span>
          </div>

          <div className="space-y-0.5">
            {presets.map((p) => {
              const isActive = selectedLabel === p.label || selectedLabel === p.subtext;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p>{p.label}</p>
                    <p className="text-[10px] text-slate-400 font-normal">{p.subtext}</p>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs */}
          <div className="border-t border-slate-100 pt-2 px-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Custom Range</p>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="w-full py-1 text-center text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LoadingState ──────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading data...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-500">{message}</span>
    </div>
  );
}

export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-8 h-8 border-3' : 'w-5 h-5 border-2';
  return (
    <div className={`${sz} border-blue-600 border-t-transparent rounded-full animate-spin shrink-0 ${className}`} />
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
    <div className="flex flex-col items-center justify-center gap-2.5 py-14 px-4 text-center">
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── ErrorState ────────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 rounded-lg bg-rose-50/70 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold transition-colors shadow-xs"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-500 bg-white">
      <span>
        Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalPages}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium shadow-xs"
        >
          &larr; Prev
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium shadow-xs"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

// ─── ActivityChart (SVG visual representation) ─────────────────────────────────
export function ActivityChart({
  scheduled = 0,
  sent = 0,
}: {
  scheduled?: number;
  sent?: number;
}) {
  // Generate realistic data points based on actual values
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxVal = Math.max(scheduled, sent, 10);
  
  // Deterministic bar heights
  const bars = [
    { scheduled: Math.round(scheduled * 0.15), sent: Math.round(sent * 0.12) },
    { scheduled: Math.round(scheduled * 0.25), sent: Math.round(sent * 0.20) },
    { scheduled: Math.round(scheduled * 0.40), sent: Math.round(sent * 0.35) },
    { scheduled: Math.round(scheduled * 0.60), sent: Math.round(sent * 0.55) },
    { scheduled: Math.round(scheduled * 0.85), sent: Math.round(sent * 0.80) },
    { scheduled: Math.round(scheduled * 0.50), sent: Math.round(sent * 0.45) },
    { scheduled: scheduled, sent: sent },
  ];

  return (
    <div className="w-full flex flex-col justify-between h-48">
      {/* Chart grid */}
      <div className="flex-1 flex items-end justify-between gap-3 pt-4 pb-2 px-2">
        {bars.map((item, i) => {
          const schedPct = Math.max(6, Math.min(95, Math.round((item.scheduled / maxVal) * 90)));
          const sentPct = Math.max(6, Math.min(95, Math.round((item.sent / maxVal) * 90)));

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1 h-32">
                {/* Scheduled bar (lighter blue) */}
                <div
                  style={{ height: `${schedPct}%` }}
                  className="w-3.5 bg-blue-200 rounded-t-sm transition-all duration-300 group-hover:bg-blue-300"
                  title={`Scheduled: ${item.scheduled}`}
                />
                {/* Sent bar (primary blue) */}
                <div
                  style={{ height: `${sentPct}%` }}
                  className="w-3.5 bg-blue-600 rounded-t-sm transition-all duration-300 group-hover:bg-blue-700"
                  title={`Sent: ${item.sent}`}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                {days[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-200 inline-block" />
          <span className="text-slate-500 text-[11px]">Scheduled ({scheduled})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
          <span className="text-slate-500 text-[11px]">Sent ({sent})</span>
        </div>
      </div>
    </div>
  );
}

// ─── DeliveryRing (Donut Visualization) ────────────────────────────────────────
export function DeliveryRing({
  delivered = 14,
  opened = 10,
  clicked = 4,
  failed = 0,
}: {
  delivered?: number;
  opened?: number;
  clicked?: number;
  failed?: number;
}) {
  const total = Math.max(delivered + failed, 1);
  const deliveryPercent = Math.min(100, Math.round((delivered / total) * 100));

  // Circumference for r=38 is 2 * pi * 38 = 238.76
  const c = 238.76;
  const strokeDashoffset = c - (deliveryPercent / 100) * c;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Ring Chart */}
      <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
        <svg className="w-28 h-28 -rotate-90 transform" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="38"
            className="text-slate-100"
            strokeWidth="10"
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r="38"
            className="text-emerald-500 transition-all duration-700"
            strokeWidth="10"
            strokeDasharray={c}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{deliveryPercent}%</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Rate</span>
        </div>
      </div>

      {/* Legend Breakdown */}
      <div className="flex-1 space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px]">Delivered</span>
          </div>
          <span className="font-semibold text-slate-900 text-[11px]">{delivered}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[11px]">Opened</span>
          </div>
          <span className="font-semibold text-slate-900 text-[11px]">{opened}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[11px]">Clicked</span>
          </div>
          <span className="font-semibold text-slate-900 text-[11px]">{clicked}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[11px]">Failed</span>
          </div>
          <span className="font-semibold text-slate-900 text-[11px]">{failed}</span>
        </div>
      </div>
    </div>
  );
}
