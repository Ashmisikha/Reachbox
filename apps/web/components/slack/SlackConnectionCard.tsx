'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { slackApiService, SlackStatusResponse } from '../../services/slack.service';
import { Bell, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';

interface SlackConnectionCardProps {
  isAuthenticated: boolean;
}

export function SlackConnectionCard({ isAuthenticated }: SlackConnectionCardProps) {
  const [status, setStatus] = useState<SlackStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await slackApiService.getStatus();
      setStatus(data);
    } catch {
      setError('Failed to fetch Slack connection status');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = () => {
    window.location.href = slackApiService.getConnectUrl();
  };

  const handleDisconnect = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const success = await slackApiService.disconnect();
      if (success) {
        setStatus({ connected: false, status: 'DISCONNECTED' });
      } else {
        setError('Failed to disconnect Slack');
      }
    } catch {
      setError('An error occurred during disconnection');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="w-full p-5 mb-8 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Slack Notifications</h3>
              {status?.connected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {status?.connected
                ? `Active in workspace "${status.teamName || 'Slack Workspace'}"${status.channelName ? ` (${status.channelName})` : ''}`
                : 'Connect your Slack workspace to receive instant alerts when hourly rate limits are reached.'}
            </p>
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-2">
              <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Checking Slack...
            </div>
          ) : status?.connected ? (
            <button
              onClick={handleDisconnect}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5 text-red-400" />
              {isProcessing ? 'Disconnecting...' : 'Disconnect Slack'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4A154B] hover:bg-[#611f69] text-white text-xs font-semibold shadow transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              Connect Slack
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
