'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useSenders } from '../../hooks/useCampaigns';
import { useOnboarding } from '../../hooks/useOnboarding';
import { senderService } from '../../services/campaign.service';
import { LegalModal, LegalTab } from '../../components/legal/LegalModal';
import {
  Mail,
  Building,
  Send,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Check,
  X,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Welcome', subtext: 'Get started' },
  { id: 2, label: 'Workspace', subtext: 'Set your identity' },
  { id: 3, label: 'Sender', subtext: 'Configure sending' },
  { id: 4, label: 'Delivery', subtext: 'Set preferences' },
  { id: 5, label: 'Complete', subtext: "You're ready" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { saveSetup, isLoading: onboardingLoading } = useOnboarding();
  const { senders, refresh: refreshSenders } = useSenders();

  const [currentStep, setCurrentStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [userName, setUserName] = useState('');
  const [minDelayMs, setMinDelayMs] = useState(1000);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // Add Sender Modal state
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [isAddingSender, setIsAddingSender] = useState(false);
  const [senderError, setSenderError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Legal Modal State
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');

  const openLegalModal = (tab: LegalTab) => (e: React.MouseEvent) => {
    e.preventDefault();
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  // Prefill initial user values
  useEffect(() => {
    if (user?.name && !userName) {
      setUserName(user.name);
    }
  }, [user, userName]);

  // Auth gate: redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle adding sender
  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim()) return;

    setIsAddingSender(true);
    setSenderError(null);
    try {
      await senderService.create({
        email: newSenderEmail.trim(),
        name: newSenderName.trim() || undefined,
      });
      setNewSenderEmail('');
      setNewSenderName('');
      setShowAddSender(false);
      await refreshSenders();
    } catch (err: any) {
      setSenderError(err.message || 'Failed to create sender');
    } finally {
      setIsAddingSender(false);
    }
  };

  // Skip setup flow
  const handleSkipSetup = async () => {
    setIsSubmitting(true);
    const userId = user?.id || 'default';
    if (typeof window !== 'undefined') {
      localStorage.setItem(`reachinbox_setup_dismissed_${userId}`, 'true');
    }
    try {
      await saveSetup({ setupCompleted: false });
    } finally {
      setIsSubmitting(false);
      router.push('/dashboard');
    }
  };

  // Complete setup flow
  const handleCompleteSetup = async () => {
    setIsSubmitting(true);
    const userId = user?.id || 'default';
    if (typeof window !== 'undefined') {
      localStorage.setItem(`reachinbox_setup_dismissed_${userId}`, 'true');
    }
    try {
      await saveSetup({
        setupCompleted: true,
        workspaceName: workspaceName.trim() || 'My Workspace',
        userName: userName.trim() || undefined,
        minDelayMs: Number(minDelayMs),
        hourlyLimit: Number(hourlyLimit),
      });
    } finally {
      setIsSubmitting(false);
      router.push('/dashboard');
    }
  };

  const hasConfiguredSender = senders && senders.length > 0;

  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen bg-[#060B14] flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Loading workspace setup...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#060B14] text-slate-100 flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">ReachInbox</div>
            <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
              Email Engine
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Setup your workspace
          </span>
          <div className="text-xs font-medium text-slate-300">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>
      </header>

      {/* Main Body Grid: Stepper on Left + Card on Right */}
      <div className="relative z-10 max-w-5xl mx-auto w-full my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─── Left Stepper (4 cols) ─────────────────────────────────── */}
        <div className="lg:col-span-4 rounded-2xl bg-[#090F1B]/90 border border-slate-800/80 p-6 backdrop-blur-xl">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Setup Progress</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Configure your workspace in 5 quick steps.
              </p>
            </div>

            <div className="space-y-3">
              {STEPS.map((s) => {
                const isPassed = s.id < currentStep;
                const isCurrent = s.id === currentStep;

                return (
                  <div
                    key={s.id}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-blue-600/10 border-blue-500/30 text-white'
                        : isPassed
                        ? 'border-transparent text-slate-300'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isPassed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : s.id}
                    </div>

                    <div>
                      <div
                        className={`text-xs font-semibold ${
                          isCurrent ? 'text-white' : isPassed ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        {s.label}
                      </div>
                      <div className="text-[10px] text-slate-500">{s.subtext}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Right Content Card (8 cols) ───────────────────────────── */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0B1322]/95 border border-slate-800/80 p-8 sm:p-10 shadow-2xl backdrop-blur-xl min-h-[460px] flex flex-col justify-between">
          {/* STEP 1: WELCOME */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  Setup your workspace
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Welcome to ReachInbox
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                  Let’s get your email workspace ready. We’ll help you configure your workspace, sending identity, and delivery preferences in a few steps.
                </p>
              </div>

              {/* 3 Overview feature rows */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Set up your workspace</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Give your workspace a name and personalize your identity.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Connect a sending identity</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Use a verified email sender identity to dispatch campaigns.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Configure delivery settings</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Set inter-email sending delay and hourly rate limits.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSkipSetup}
                  disabled={isSubmitting}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Skip for now
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: WORKSPACE IDENTITY */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  Step 2 of 5
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Workspace information
                </h2>
                <p className="text-xs text-slate-300">
                  Let’s set up your workspace with some basic information.
                </p>
              </div>

              <div className="space-y-4 max-w-md pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Workspace name
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. My Workspace"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    This will be used to identify your team and workspace.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Omm Piri"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    This helps personalize your workspace experience.
                  </p>
                </div>
              </div>

              {/* Step 2 Actions */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SENDER SETUP */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  Step 3 of 5
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Set up your sending identity
                </h2>
                <p className="text-xs text-slate-300">
                  Emails are sent using a verified sender identity.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {hasConfiguredSender ? (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-slate-300">
                      Configured sender identities ({senders.length})
                    </div>
                    <div className="space-y-2">
                      {senders.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white">{s.email}</div>
                              <div className="text-[10px] text-slate-400">
                                {s.name || 'Default Sender'}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Connected
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddSender(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add another sender</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">No sender configured yet</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Add a sender to start sending email campaigns.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddSender(true)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Sender</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Add Sender Form Modal */}
                {showAddSender && (
                  <form
                    onSubmit={handleCreateSender}
                    className="p-4 rounded-xl bg-[#0F172A] border border-slate-700/80 space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="text-xs font-semibold text-white">Add New Sender</span>
                      <button
                        type="button"
                        onClick={() => setShowAddSender(false)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {senderError && (
                      <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                        {senderError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Sender Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={newSenderEmail}
                          onChange={(e) => setNewSenderEmail(e.target.value)}
                          placeholder="sender@domain.com"
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={newSenderName}
                          onChange={(e) => setNewSenderName(e.target.value)}
                          placeholder="Marketing Team"
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddSender(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingSender}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-xs"
                      >
                        {isAddingSender ? 'Adding...' : 'Save Sender'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Step 3 Actions */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: DELIVERY SETTINGS */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  Step 4 of 5
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Configure delivery settings
                </h2>
                <p className="text-xs text-slate-300">
                  These controls help maintain predictable delivery and good sender reputation.
                </p>
              </div>

              <div className="space-y-4 max-w-md pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Minimum delay between emails (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={minDelayMs}
                    onChange={(e) => setMinDelayMs(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Time to wait between sending each email via SMTP.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Hourly sending limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Maximum number of emails to send per hour window.
                  </p>
                </div>
              </div>

              {/* Step 4 Actions */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: SETUP COMPLETE */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Your workspace is ready
                </h2>
                <p className="text-xs text-slate-300">
                  You’re all set! You can now start creating and sending email campaigns with ReachInbox.
                </p>
              </div>

              {/* Real checklist of configured items */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">Account connected</span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {user?.email || 'Authenticated User'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">Workspace configured</span>
                    <p className="text-[10px] text-slate-400">{workspaceName || 'My Workspace'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                      hasConfiguredSender
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {hasConfiguredSender ? <Check className="w-3.5 h-3.5" /> : '—'}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">
                      Sending identity {hasConfiguredSender ? 'configured' : 'pending'}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {hasConfiguredSender
                        ? senders[0]?.email
                        : 'Optional — can be added later in Senders'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">
                      Delivery settings configured
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {minDelayMs}ms delay &bull; {hourlyLimit} emails/hour limit
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 5 Actions */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSkipSetup}
                    disabled={isSubmitting}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2"
                  >
                    Maybe later
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteSetup}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-2 transition-all"
                  >
                    <span>{isSubmitting ? 'Saving...' : 'Go to Dashboard'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full pt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>&copy; {new Date().getFullYear()} ReachInbox Inc. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            onClick={openLegalModal('privacy')}
            className="hover:text-slate-300 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            onClick={openLegalModal('terms')}
            className="hover:text-slate-300 transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/support"
            onClick={openLegalModal('support')}
            className="hover:text-slate-300 transition-colors"
          >
            Support
          </Link>
        </div>
      </footer>

      {/* Legal & Support Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        activeTab={legalModalTab}
        onTabChange={setLegalModalTab}
      />
    </main>
  );
}
