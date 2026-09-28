'use client';
import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Clock,
  Send,
  BarChart3,
  Cpu,
  Users,
  Plug,
  Settings,
  Search,
} from 'lucide-react';

export function ProductPreview() {
  return (
    <div className="relative w-full max-w-[500px] select-none pointer-events-none">
      {/* Subtle back ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600/20 to-cyan-500/10 rounded-2xl blur-xl opacity-70" />

      {/* Angled 3D Card Shell */}
      <div
        className="relative rounded-xl border border-slate-700/60 bg-[#0A101D] shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(37,99,235,0.1)] overflow-hidden transition-transform duration-500"
        style={{
          transform: 'perspective(1000px) rotateY(-8deg) rotateX(4deg) translateZ(0)',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="grid grid-cols-12 min-h-[340px]">
          {/* ─── Mini Sidebar (4 cols) ─────────────────────────────────── */}
          <div className="col-span-4 border-r border-slate-800/80 bg-[#070D18] p-3 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Brand Header */}
              <div className="flex items-center gap-1.5 px-1">
                <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white shadow-xs">
                  <span className="w-1.5 h-1.5 bg-white rounded-xs" />
                </div>
                <div className="leading-none">
                  <span className="text-[10px] font-bold tracking-tight text-white block">ReachInbox</span>
                  <span className="text-[6.5px] font-semibold text-slate-500 uppercase tracking-widest block">Email Engine</span>
                </div>
              </div>

              {/* Navigation */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600/15 border border-blue-500/30 text-blue-400 text-[10px] font-medium">
                  <LayoutDashboard className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>Overview</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Layers className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Campaigns</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Send className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Sent</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <BarChart3 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Analytics</span>
                </div>
              </div>

              {/* Operations */}
              <div className="space-y-0.5 pt-1">
                <div className="text-[7.5px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                  Operations
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Cpu className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Queues</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Users className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Senders</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Plug className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Integrations</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Settings className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Settings</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Main Content Preview Area (8 cols) ────────────────────── */}
          <div className="col-span-8 p-3 flex flex-col justify-between space-y-2.5 bg-[#090F1B]">
            {/* Top Search Bar */}
            <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-[9px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Search className="w-2.5 h-2.5 text-slate-500" />
                <span className="truncate">Search emails, campaigns...</span>
              </div>
              <span className="font-mono text-[8px] text-slate-500 shrink-0">Ctrl K</span>
            </div>

            {/* Overview Heading */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white tracking-tight">Overview</span>
            </div>

            {/* 2 Metric Blocks */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-[8.5px] font-medium text-slate-400">Campaigns</div>
                <div className="text-sm font-bold text-white mt-0.5">—</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-[8.5px] font-medium text-slate-400">Scheduled</div>
                <div className="text-sm font-bold text-white mt-0.5">—</div>
              </div>
            </div>

            {/* Email Activity Bar Chart */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="text-[8.5px] font-semibold text-slate-400">Email Activity</div>
              <div className="flex items-end justify-between gap-1 pt-1 h-16">
                <div className="flex flex-col justify-between h-full text-[7.5px] text-slate-500 font-mono pr-1">
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
                {/* 5 Day Bars */}
                {[
                  { day: 'Mon', height: '15%' },
                  { day: 'Tue', height: '28%' },
                  { day: 'Wed', height: '55%' },
                  { day: 'Thu', height: '90%' },
                  { day: 'Fri', height: '40%' },
                ].map((bar) => (
                  <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className="w-full max-w-[12px] bg-blue-500 rounded-t-xs transition-all"
                      style={{ height: bar.height }}
                    />
                    <span className="text-[7px] text-slate-400">{bar.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Campaigns Table Skeleton */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[7.5px] font-semibold uppercase tracking-wider text-slate-500 pb-0.5 border-b border-slate-800/80">
                <span>Name</span>
                <span>Status</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-xs" />
                  <div className="w-8 h-1.5 bg-slate-800 rounded-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-xs" />
                  <div className="w-10 h-1.5 bg-slate-800 rounded-xs" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
