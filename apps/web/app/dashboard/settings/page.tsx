'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useOnboarding } from '../../../hooks/useOnboarding';
import { Card, PageHeader } from '../../../components/ui';
import {
  User,
  Building,
  Mail,
  Shield,
  Bell,
  Key,
  LogOut,
  Save,
  Play,
  RotateCcw,
} from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'workspace', label: 'Workspace', icon: Building },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'api_keys', label: 'API Keys', icon: Key },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { status, replayTour, resetSetup } = useOnboarding();
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || 'Demo User');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReplayTour = async () => {
    const userId = user?.id || 'default';
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`reachinbox_tour_completed_${userId}`);
    }
    await replayTour();
    router.push('/dashboard?tour=true');
  };

  const handleRestartSetup = async () => {
    const userId = user?.id || 'default';
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`reachinbox_setup_dismissed_${userId}`);
    }
    await resetSetup();
    router.push('/onboarding');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Settings"
        description="Manage your workspace preferences, profile, and security controls."
        actions={
          <button
            onClick={handleSave}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saved ? 'Saved!' : 'Save Changes'}</span>
          </button>
        }
      />

      {/* ─── Split Settings Layout (Screen 16 in PDF) ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Settings Sidebar (3 cols) */}
        <div className="md:col-span-3 space-y-1">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  isActive
                    ? 'bg-white border border-slate-200 text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-blue-600' : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Content (9 cols) */}
        <div className="md:col-span-9 space-y-6">
          {activeTab === 'profile' && (
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Profile Details</h3>
                <p className="text-xs text-slate-500">Your personal identity in ReachInbox</p>
              </div>

              {/* Avatar Section */}
              <div className="flex items-center gap-4">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-14 h-14 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-lg font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'D'}
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs"
                  >
                    Change Avatar
                  </button>
                  <p className="text-[11px] text-slate-400 mt-1">JPG, GIF or PNG. 1MB max.</p>
                </div>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSave} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || 'demo@reachinbox.ai'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Timezone
                  </label>
                  <select className="w-full sm:w-72 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option>UTC (Coordinated Universal Time)</option>
                    <option>America/New_York (EST)</option>
                    <option>Europe/London (GMT)</option>
                    <option>Asia/Kolkata (IST)</option>
                  </select>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Security &amp; Session</h3>
                <p className="text-xs text-slate-500">Active session tokens and database permissions</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900">Current Session</span>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Token: SHA-256 hashed session in PostgreSQL
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </Card>
          )}

          {activeTab === 'workspace' && (
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Workspace Settings</h3>
                <p className="text-xs text-slate-500">Configure workspace parameters and onboarding</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    defaultValue={status?.workspaceName || 'My Workspace'}
                    className="w-full sm:w-80 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">Product Tour &amp; Onboarding</h4>
                    <p className="text-[11px] text-slate-500">
                      Replay the guided interactive tour or re-run the initial workspace setup wizard.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReplayTour}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Replay product tour</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRestartSetup}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restart workspace setup</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab !== 'profile' && activeTab !== 'workspace' && activeTab !== 'security' && (
            <Card className="p-8 text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-700 capitalize">{activeTab} configuration</p>
              <p className="mt-1">All {activeTab} settings are managed through your workspace environment.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
