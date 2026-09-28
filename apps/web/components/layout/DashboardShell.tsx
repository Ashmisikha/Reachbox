'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { TourManager } from '../tour/TourManager';
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
  Bell,
  LogOut,
  Mail,
  HelpCircle,
  Command,
  Sparkles,
  CheckCheck,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  BookUser,
} from 'lucide-react';

interface NavSection {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
    tourId?: string;
  }[];
}

const NAVIGATION_SECTIONS: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, tourId: 'nav-dashboard' },
      { href: '/dashboard/campaigns', label: 'Campaigns', icon: Layers, tourId: 'nav-campaigns' },
      { href: '/dashboard/contacts', label: 'Contacts', icon: BookUser, tourId: 'nav-contacts' },
      { href: '/dashboard/scheduled', label: 'Scheduled', icon: Clock, tourId: 'nav-scheduled' },
      { href: '/dashboard/sent', label: 'Sent', icon: Send, tourId: 'nav-sent' },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, tourId: 'nav-analytics' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { href: '/dashboard/queues', label: 'Queues', icon: Cpu, tourId: 'nav-queues' },
      { href: '/dashboard/senders', label: 'Senders', icon: Users, tourId: 'nav-senders' },
      { href: '/dashboard/integrations', label: 'Integrations', icon: Plug, tourId: 'nav-integrations' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [{ href: '/dashboard/settings', label: 'Settings', icon: Settings, tourId: 'nav-settings' }],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex flex-col h-full w-[230px] shrink-0 bg-[#0B1220] text-slate-300 border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs">
          <Mail className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white tracking-tight">ReachInbox</span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
            Email Engine
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAVIGATION_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            {section.items.map(({ href, label, icon: Icon, tourId }) => {
              const isActive =
                pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  data-tour={tourId}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800/90 text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-blue-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Workspace Profile Footer */}
      {user && (
        <div className="border-t border-slate-800/80 p-3 bg-[#080E18]">
          <div className="flex items-center gap-2.5 p-2 rounded-md bg-slate-800/30">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-full border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate font-mono">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function DashboardTopBar() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'BullMQ Queues Active',
      desc: 'Delayed job scheduler & workers are running smoothly.',
      time: 'Just now',
      unread: true,
      href: '/dashboard/queues',
    },
    {
      id: '2',
      title: 'SMTP Dispatcher Connected',
      desc: 'Ethereal SMTP transport initialized for deterministic dispatch.',
      time: '5m ago',
      unread: true,
      href: '/dashboard/senders',
    },
    {
      id: '3',
      title: 'Elasticsearch Index Online',
      desc: 'Email search indices synchronized with PostgreSQL source of truth.',
      time: '14m ago',
      unread: true,
      href: '/dashboard/sent',
    },
    {
      id: '4',
      title: 'Hourly Rate Limiter Active',
      desc: 'Redis atomic counters monitoring campaign throughput.',
      time: '1h ago',
      unread: false,
      href: '/dashboard/settings',
    },
  ]);

  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: ⌘K or Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsHelpOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setIsHelpOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/dashboard/sent?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleStartTour = () => {
    setIsHelpOpen(false);
    window.dispatchEvent(new CustomEvent('reachinbox:start-tour'));
    if (pathname !== '/dashboard') {
      router.push('/dashboard?tour=true');
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (id: string, href: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setIsNotificationsOpen(false);
    router.push(href);
  };

  return (
    <header className="h-14 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 relative z-30">
      {/* Global Search Bar with ⌘K shortcut */}
      <form onSubmit={handleSearch} data-tour="global-search" className="flex-1 max-w-sm">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns, emails, recipients... (⌘K)"
            className="w-full pl-8 pr-12 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          <div className="absolute right-2 flex items-center gap-0.5 text-[10px] font-mono font-medium text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        </div>
      </form>

      {/* Top Right Utilities */}
      <div className="flex items-center gap-3">
        {/* ─── Help & Resources Dropdown ────────────────────────────── */}
        <div className="relative" ref={helpRef}>
          <button
            type="button"
            onClick={() => {
              setIsHelpOpen(!isHelpOpen);
              setIsNotificationsOpen(false);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              isHelpOpen
                ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Help & Tour"
            aria-expanded={isHelpOpen}
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">ReachInbox Help & Guides</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-semibold">
                  v1.0.0
                </span>
              </div>

              {/* Interactive Tour Card */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Interactive Product Tour</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Walk through all navigation targets, BullMQ queues, and campaign dispatch tools.
                </p>
                <button
                  type="button"
                  onClick={handleStartTour}
                  className="w-full mt-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Launch Walkthrough</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Quick Navigation Links */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                  Quick Guides
                </p>
                <Link
                  href="/dashboard/senders"
                  onClick={() => setIsHelpOpen(false)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>Sender Accounts & Ethereal SMTP</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </Link>
                <Link
                  href="/dashboard/queues"
                  onClick={() => setIsHelpOpen(false)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>BullMQ Workers & Job Monitoring</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsHelpOpen(false)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>Delivery Limits & Send Throttle</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </Link>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Shortcut: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">⌘K</code> Search</span>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsHelpOpen(false)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Settings &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ─── Notifications Dropdown ───────────────────────────────── */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsHelpOpen(false);
            }}
            className={`relative p-1.5 rounded-md transition-colors ${
              isNotificationsOpen
                ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Notifications"
            aria-expanded={isNotificationsOpen}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white absolute top-1 right-1" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-84 rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">All caught up</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification Items */}
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNotificationClick(item.id, item.href)}
                    className={`w-full p-2 rounded-lg text-left transition-colors flex items-start gap-2.5 ${
                      item.unread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.unread ? (
                        <span className="w-2 h-2 rounded-full bg-blue-600 block mt-1" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${item.unread ? 'text-slate-900' : 'text-slate-700'}`}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight line-clamp-2 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href="/dashboard/queues"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>View BullMQ Queue Monitor</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* User Badge */}
        {user && (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-6 h-6 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-700 hidden sm:inline-block">
              {user.name}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] text-slate-900">
      <TourManager />
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardTopBar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
