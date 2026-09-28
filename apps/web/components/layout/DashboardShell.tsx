'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Layers,
  Clock,
  Send,
  BarChart3,
  Users,
  Plug,
  Settings,
  Plus,
  Search,
  Bell,
  LogOut,
  Mail,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dashboard/campaigns',   label: 'Campaigns',   icon: Layers },
  { href: '/dashboard/scheduled',   label: 'Scheduled',   icon: Clock },
  { href: '/dashboard/sent',        label: 'Sent Emails', icon: Send },
  { href: '/dashboard/analytics',   label: 'Analytics',   icon: BarChart3 },
  { href: '/dashboard/senders',     label: 'Senders',     icon: Users },
  { href: '/dashboard/integrations',label: 'Integrations',icon: Plug },
  { href: '/dashboard/settings',    label: 'Settings',    icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex flex-col h-full w-64 shrink-0 bg-[#0f172a] text-slate-300 border-r border-slate-800 select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/80">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
          <Mail className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-white tracking-tight">ReachInbox</span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Email Engine</span>
        </div>
      </div>

      {/* Quick Action Compose */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/dashboard/compose"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-wide shadow-sm transition-all duration-150 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Campaign</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Main Menu
        </div>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="border-t border-slate-800/80 p-3 bg-slate-900/50">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate font-mono">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function DashboardTopBar() {
  const { user } = useAuth();
  const [query, setQuery] = React.useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/dashboard/sent?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200/90 flex items-center justify-between gap-4 shrink-0">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sent emails, recipients..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>

        {/* User badge */}
        {user && (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-semibold text-slate-700 hidden sm:inline-block">
              {user.name}
            </span>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-xs font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardTopBar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
