'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { onboardingApiService } from '../../services/onboarding.service';
import { ProductFeature } from './ProductFeature';
import { ProductPreview } from './ProductPreview';
import { OAuthButtons } from './OAuthButtons';
import { LoginForm } from './LoginForm';
import { LegalModal, LegalTab } from '../legal/LegalModal';
import {
  Send,
  BarChart3,
  Database,
  Mail,
} from 'lucide-react';

export function LoginPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');

  const openLegalModal = (tab: LegalTab) => (e: React.MouseEvent) => {
    e.preventDefault();
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  // If already authenticated, check onboarding status: new users go to /onboarding, completed users go to /dashboard
  useEffect(() => {
    let isMounted = true;
    async function checkAuthRoute() {
      if (!isLoading && isAuthenticated && user) {
        try {
          const onboarding = await onboardingApiService.getStatus();
          const hasSkipped =
            typeof window !== 'undefined' &&
            localStorage.getItem(`reachinbox_setup_dismissed_${user.id}`) === 'true';

          if (isMounted) {
            // Only redirect to /onboarding if user has never completed OR skipped setup
            if (onboarding && !onboarding.setupCompleted && !hasSkipped) {
              router.push('/onboarding');
              return;
            }
            router.push('/dashboard');
          }
        } catch {
          if (isMounted) {
            router.push('/dashboard');
          }
        }
      }
    }
    checkAuthRoute();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user, isLoading, router]);

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#060A12] text-slate-100 overflow-x-hidden">
      {/* ─── LEFT PANEL (Brand + Positioning, ~55% / 7 cols) ────────── */}
      <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-10 xl:p-14 relative bg-[#070D1A] border-r border-slate-800/80 overflow-hidden">
        {/* Subtle Navy Perspective Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Ambient Glow */}
        <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Mail className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">ReachInbox</div>
              <div className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-widest">
                Email Engine
              </div>
            </div>
          </div>

          {/* Social Proof Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[11px] font-medium">Trusted by modern teams</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="relative z-10 my-auto py-8">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
            {/* Left Narrative & 3 Capabilities (7 cols) */}
            <div className="xl:col-span-6 space-y-6">
              {/* Main Headline */}
              <div className="space-y-3">
                <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                  Build, send and <br />
                  scale your{' '}
                  <span className="text-blue-500">outreach.</span>
                </h1>

                <p className="text-xs xl:text-sm text-slate-400 leading-relaxed max-w-md">
                  A reliable email infrastructure to run campaigns, monitor deliverability and keep your outreach organized — all in one place.
                </p>
              </div>

              {/* 3 Concise Product Capabilities */}
              <div className="space-y-4 pt-2">
                <ProductFeature
                  icon={<Send className="w-4 h-4" />}
                  title="Deterministic sending"
                  description="Scheduled delivery with BullMQ and rate limiting."
                />
                <ProductFeature
                  icon={<BarChart3 className="w-4 h-4" />}
                  title="Real-time visibility"
                  description="Monitor queues, delivery progress and detailed analytics."
                />
                <ProductFeature
                  icon={<Database className="w-4 h-4" />}
                  title="Built for teams"
                  description="Multi-sender support, Slack notifications and powerful search."
                />
              </div>
            </div>

            {/* Right: Floating Angled Dashboard Preview (5 cols) */}
            <div className="xl:col-span-6 flex justify-center xl:justify-end">
              <ProductPreview />
            </div>
          </div>
        </div>

        {/* Bottom Left Note */}
        <div className="relative z-10 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80" />
          <span>BullMQ · Redis · PostgreSQL · Elasticsearch · Ethereal SMTP</span>
        </div>
      </div>

      {/* ─── RIGHT PANEL (Authentication, ~45% / 5 cols) ─────────────── */}
      <div className="col-span-1 lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 xl:p-14 bg-[#060A12] relative">
        {/* Top-Right: New Here? Create an Account */}
        <div className="flex items-center justify-between lg:justify-end gap-3">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">ReachInbox</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">
              {authMode === 'signin' ? 'New here?' : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={() => setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-200 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              {authMode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </div>
        </div>

        {/* Centered Login Card */}
        <div className="w-full max-w-sm mx-auto my-auto py-8 space-y-6">
          {/* Center Brand & Heading */}
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-600/30">
              <Mail className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight">ReachInbox</div>
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                Email Engine
              </div>
            </div>

            <div className="pt-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {authMode === 'signin' ? 'Sign in to your workspace' : 'Create your account'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {authMode === 'signin'
                  ? 'Access your campaigns, senders and delivery analytics.'
                  : 'Start scheduling, sending and scaling your cold outreach.'}
              </p>
            </div>
          </div>

          {/* OAuth Buttons (Google + Slack) */}
          <OAuthButtons />

          {/* Subtle Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-slate-800" />
            <span className="absolute px-3 bg-[#060A12] text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Or continue with email
            </span>
          </div>

          {/* Email / Password Form + Local Dev Box */}
          <LoginForm
            authMode={authMode}
            onToggleMode={() => setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
          />
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} ReachInbox Inc.</span>
          <div className="flex items-center gap-4 text-xs">
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
        </div>
      </div>

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
