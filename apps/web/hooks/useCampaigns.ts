'use client';
import { useState, useEffect, useCallback } from 'react';
import { campaignService, DashboardStats, Campaign, ScheduledEmail, SentEmail, PaginationMeta } from '../services/campaign.service';
import { senderService, SenderAccount } from '../services/campaign.service';

// ─── useDashboardStats ─────────────────────────────────────────────────────────
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await campaignService.getStats();
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { stats, isLoading, error, refresh: load };
}

// ─── useCampaigns ──────────────────────────────────────────────────────────────
export function useCampaigns(page = 1, pageSize = 20) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await campaignService.list(page, pageSize);
      setCampaigns(data.campaigns);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);
  return { campaigns, pagination, isLoading, error, refresh: load };
}

// ─── useScheduledEmails ────────────────────────────────────────────────────────
export function useScheduledEmails(page = 1, pageSize = 25) {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await campaignService.getScheduled(page, pageSize);
      setEmails(data.emails);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load scheduled emails');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);
  return { emails, pagination, isLoading, error, refresh: load };
}

// ─── useSentEmails ─────────────────────────────────────────────────────────────
export function useSentEmails(page = 1, pageSize = 25) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await campaignService.getSent(page, pageSize);
      setEmails(data.emails);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load sent emails');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);
  return { emails, pagination, isLoading, error, refresh: load };
}

// ─── useSenders ────────────────────────────────────────────────────────────────
export function useSenders() {
  const [senders, setSenders] = useState<SenderAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await senderService.list();
      setSenders(data.senders);
    } catch (e: any) {
      setError(e.message || 'Failed to load senders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { senders, isLoading, error, refresh: load };
}
