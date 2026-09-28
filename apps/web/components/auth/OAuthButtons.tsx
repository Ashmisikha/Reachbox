'use client';
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { slackApiService } from '../../services/slack.service';

interface OAuthButtonsProps {
  disabled?: boolean;
}

export function OAuthButtons({ disabled = false }: OAuthButtonsProps) {
  const { loginWithGoogle } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSlackLoading, setIsSlackLoading] = useState(false);

  const handleGoogleClick = () => {
    if (disabled || isGoogleLoading) return;
    setIsGoogleLoading(true);
    loginWithGoogle();
  };

  const handleSlackClick = () => {
    if (disabled || isSlackLoading) return;
    setIsSlackLoading(true);
    window.location.href = slackApiService.getConnectUrl();
  };

  return (
    <div className="space-y-2.5">
      {/* Continue with Google */}
      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={disabled || isGoogleLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-700/80 bg-[#0B111E] hover:bg-slate-800 text-xs font-semibold text-white transition-colors shadow-xs disabled:opacity-60 disabled:pointer-events-none group"
      >
        {isGoogleLoading ? (
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      {/* Continue with Slack */}
      <button
        type="button"
        onClick={handleSlackClick}
        disabled={disabled || isSlackLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-700/80 bg-[#0B111E] hover:bg-slate-800 text-xs font-semibold text-white transition-colors shadow-xs disabled:opacity-60 disabled:pointer-events-none group"
      >
        {isSlackLoading ? (
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#E01E5A"
              d="M5.04 14.88a2.52 2.52 0 0 1-2.52-2.52c0-1.39 1.13-2.52 2.52-2.52h2.52v2.52c0 1.39-1.13 2.52-2.52 2.52zm1.26 0a2.52 2.52 0 0 1 2.52-2.52c1.39 0 2.52 1.13 2.52 2.52v6.3a2.52 2.52 0 0 1-2.52 2.52 2.52 2.52 0 0 1-2.52-2.52v-6.3z"
            />
            <path
              fill="#36C5F0"
              d="M9.12 5.04a2.52 2.52 0 0 1-2.52-2.52C6.6 1.13 7.73 0 9.12 0s2.52 1.13 2.52 2.52v2.52H9.12zm0 1.26a2.52 2.52 0 0 1 2.52 2.52v6.3a2.52 2.52 0 0 1-2.52 2.52 2.52 2.52 0 0 1-2.52-2.52V8.82c0-1.39 1.13-2.52 2.52-2.52z"
            />
            <path
              fill="#2EB67D"
              d="M18.96 9.12a2.52 2.52 0 0 1 2.52 2.52c0 1.39-1.13 2.52-2.52 2.52h-2.52V11.64c0-1.39 1.13-2.52 2.52-2.52zm-1.26 0a2.52 2.52 0 0 1-2.52 2.52c-1.39 0-2.52-1.13-2.52-2.52V2.82A2.52 2.52 0 0 1 15.18.3a2.52 2.52 0 0 1 2.52 2.52v6.3z"
            />
            <path
              fill="#ECB22E"
              d="M14.88 18.96a2.52 2.52 0 0 1 2.52 2.52c0 1.39-1.13 2.52-2.52 2.52s-2.52-1.13-2.52-2.52v-2.52h2.52zm0-1.26a2.52 2.52 0 0 1-2.52-2.52V8.88a2.52 2.52 0 0 1 2.52-2.52 2.52 2.52 0 0 1 2.52 2.52v6.3c0 1.39-1.13 2.52-2.52 2.52z"
            />
          </svg>
        )}
        <span>Continue with Slack</span>
      </button>
    </div>
  );
}
