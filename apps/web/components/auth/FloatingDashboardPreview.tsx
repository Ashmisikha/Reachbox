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

export function FloatingDashboardPreview() {
  return (
    <div className="relative w-full max-w-[560px] select-none pointer-events-none">
      {/* Ambient background glow behind the card */}
      <div className="absolute -inset-1.5 bg-gradient-to-tr from-blue-600/30 via-indigo-500/20 to-cyan-400/20 rounded-2xl blur-2xl opacity-75 transform -rotate-1" />

      {/* 3D Perspective Wrapper */}
      <div
        className="relative rounded-2xl border border-slate-700/60 bg-[#0E1726]/95 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_30px_rgba(37,99,235,0.15)] overflow-hidden transition-transform duration-700 hover:rotate-0"
        style={{
          transform: 'perspective(1200px) rotateY(-6deg) rotateX(3deg) scale(0.98)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Top Window Chrome / Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-[#0B1220]/90">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80" />
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-400 w-44">
            <Search className="w-3 h-3 text-slate-500" />
            <span>Search campaigns...</span>
            <span className="ml-auto font-mono text-[9px] text-slate-500">⌘K</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-slate-400">Engine Active</span>
          </div>
        </div>

        {/* Dashboard Body Grid (Mini Sidebar + Content) */}
        <div className="grid grid-cols-12 min-h-[360px]">
          {/* Mini Sidebar (3 cols) */}
          <div className="col-span-3 border-r border-slate-800/80 bg-[#070D18]/90 p-3 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Mini Brand */}
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white">
                  R
                </div>
                <span className="text-[10px] font-bold tracking-tight text-white">ReachInbox</span>
              </div>

              {/* Workspace Navigation */}
              <div className="space-y-0.5">
                <div className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                  Workspace
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600/15 border border-blue-500/30 text-blue-400 text-[10px] font-medium">
                  <LayoutDashboard className="w-3 h-3" />
                  <span>Overview</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-[10px]">
                  <Layers className="w-3 h-3 text-slate-500" />
                  <span>Campaigns</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-[10px]">
                  <Send className="w-3 h-3 text-slate-500" />
                  <span>Sent</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-[10px]">
                  <BarChart3 className="w-3 h-3 text-slate-500" />
                  <span>Analytics</span>
                </div>
              </div>

              {/* Operations */}
              <div className="space-y-0.5 pt-1">
                <div className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                  Operations
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Cpu className="w-3 h-3 text-slate-500" />
                  <span>Queues</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Users className="w-3 h-3 text-slate-500" />
                  <span>Senders</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                  <Plug className="w-3 h-3 text-slate-500" />
                  <span>Integrations</span>
                </div>
              </div>
            </div>

            {/* System Settings */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-400 text-[10px]">
                <Settings className="w-3 h-3 text-slate-500" />
                <span>Settings</span>
              </div>
            </div>
          </div>

          {/* Mini Main Content (9 cols) */}
          <div className="col-span-9 p-3.5 space-y-3 bg-[#0B1322]/80">
            {/* Header */}
            <div>
              <div className="text-[12px] font-semibold text-white">Email operations at a glance</div>
              <div className="text-[9px] text-slate-400">Track campaign performance and delivery metrics.</div>
            </div>

            {/* Metric Cards Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-[#111C2E] border border-slate-800/80">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] uppercase tracking-wider font-medium">Scheduled</span>
                  <Clock className="w-3 h-3 text-blue-400" />
                </div>
                <div className="text-base font-bold text-white mt-1">1,000</div>
                <div className="text-[8px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span>↑ Queued for dispatch</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#111C2E] border border-slate-800/80">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] uppercase tracking-wider font-medium">Delivered</span>
                  <Send className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-base font-bold text-white mt-1">1,000</div>
                <div className="text-[8px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span>100% Delivery rate</span>
                </div>
              </div>
            </div>

            {/* Mini Chart: Email Activity */}
            <div className="p-2.5 rounded-lg bg-[#111C2E] border border-slate-800/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-semibold text-slate-300">Email Activity</span>
                <div className="flex items-center gap-2 text-[8px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Scheduled
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Sent
                  </span>
                </div>
              </div>

              {/* Pure SVG Bar Visualizer */}
              <div className="h-14 flex items-end gap-2 pt-2 px-1 border-b border-slate-800">
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                  <div className="w-2 rounded-t bg-blue-500" style={{ height: '40%' }} />
                  <span className="text-[7px] text-slate-500">M</span>
                </div>
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                  <div className="w-2 rounded-t bg-blue-500" style={{ height: '65%' }} />
                  <span className="text-[7px] text-slate-500">T</span>
                </div>
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                  <div className="w-2 rounded-t bg-emerald-500" style={{ height: '85%' }} />
                  <span className="text-[7px] text-slate-500">W</span>
                </div>
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                  <div className="w-2 rounded-t bg-emerald-500" style={{ height: '70%' }} />
                  <span className="text-[7px] text-slate-500">T</span>
                </div>
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                  <div className="w-2 rounded-t bg-blue-500" style={{ height: '90%' }} />
                  <span className="text-[7px] text-slate-500">F</span>
                </div>
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                  <div className="w-2 rounded-t bg-emerald-400" style={{ height: '50%' }} />
                  <span className="text-[7px] text-slate-500">S</span>
                </div>
              </div>
            </div>

            {/* Mini Table: Recent Campaigns */}
            <div className="p-2.5 rounded-lg bg-[#111C2E] border border-slate-800/80">
              <div className="text-[9px] font-semibold text-slate-300 mb-1.5">Recent Campaigns</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[8px] py-1 border-b border-slate-800/60">
                  <span className="font-medium text-white truncate max-w-[120px]">Product Launch</span>
                  <span className="text-slate-400 font-mono">1,000</span>
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Completed
                  </span>
                </div>
                <div className="flex items-center justify-between text-[8px] py-1 border-b border-slate-800/60">
                  <span className="font-medium text-white truncate max-w-[120px]">Partnership Outreach</span>
                  <span className="text-slate-400 font-mono">500</span>
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Scheduled
                  </span>
                </div>
                <div className="flex items-center justify-between text-[8px] py-1">
                  <span className="font-medium text-white truncate max-w-[120px]">Beta Feedback</span>
                  <span className="text-slate-400 font-mono">250</span>
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Sending
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
