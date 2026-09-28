'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { onboardingApiService } from '../../services/onboarding.service';
import { Mail, Lock, Eye, EyeOff, ArrowRight, FlaskConical, AlertCircle, User } from 'lucide-react';

interface LoginFormProps {
  authMode?: 'signin' | 'signup';
  onToggleMode?: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ authMode = 'signin', onToggleMode, onSuccess }: LoginFormProps) {
  const router = useRouter();
  const { loginWithEmail, error: authError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSignUp = authMode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Please enter a valid email address (e.g. you@company.com).');
      return;
    }

    if (isSignUp && !name.trim()) {
      setFormError('Please enter your name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await loginWithEmail(cleanEmail, isSignUp ? name.trim() : undefined);
      
      // Determine redirection based on onboarding state
      try {
        const onboarding = await onboardingApiService.getStatus();
        const hasSkipped =
          typeof window !== 'undefined' &&
          localStorage.getItem(`reachinbox_setup_dismissed_${loggedUser.id}`) === 'true';

        if (onboarding && !onboarding.setupCompleted && !hasSkipped) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      } catch {
        router.push('/dashboard');
      }

      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await loginWithEmail('demo@reachinbox.ai', 'Demo User');
      router.push('/dashboard');
      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || 'Demo sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Form or Auth Error Display */}
      {(formError || authError) && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{formError || authError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Full Name (when signing up) */}
        {isSignUp && (
          <div className="space-y-1.5 animate-fadeIn">
            <label className="block text-xs font-medium text-slate-300">
              Full name
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                disabled={isSubmitting}
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#0B111E] border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {/* Email Address */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Email address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={isSubmitting}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#0B111E] border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-60"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-300">
              Password
            </label>
            {isSignUp && (
              <span className="text-[10px] text-slate-400">Optional for email access</span>
            )}
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'Create a secure password' : 'Enter your password'}
              disabled={isSubmitting}
              className="w-full pl-9 pr-9 py-2 text-xs bg-[#0B111E] border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Keep Me Signed In & Forgot Password */}
        {!isSignUp && (
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Keep me signed in</span>
            </label>
            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                setFormError('Email accounts sign in passwordless or via Google/Slack authentication.');
              }}
              className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              Forgot password?
            </a>
          </div>
        )}

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all hover:shadow-blue-600/40 disabled:opacity-60 disabled:pointer-events-none mt-2"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{isSignUp ? 'Create account' : 'Sign in with email'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        {/* Mode Switch Helper */}
        {onToggleMode && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              {isSignUp ? (
                <span>Already have an account? <span className="font-semibold text-blue-400 underline underline-offset-2">Sign in</span></span>
              ) : (
                <span>Don&apos;t have an account? <span className="font-semibold text-blue-400 underline underline-offset-2">Create one</span></span>
              )}
            </button>
          </div>
        )}
      </form>

      {/* Local Development Mode Notice Card */}
      <div
        onClick={handleDemoSignIn}
        className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/90 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors group"
        title="Click to sign in immediately with local development mode"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0 mt-0.5 group-hover:text-blue-400 transition-colors">
          <FlaskConical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Local development mode</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">1-Click</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Click here to immediately sign in as <span className="font-mono text-blue-400 font-medium">demo@reachinbox.ai</span> without credentials.
          </p>
        </div>
      </div>
    </div>
  );
}

