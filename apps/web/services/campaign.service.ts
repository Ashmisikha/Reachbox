import {
  CampaignAnalytics,
  CampaignEvent,
  CampaignStep,
  CreateCampaignStepInput,
  SenderHealthMetrics,
} from '@reachinbox/shared';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SenderAccount {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  subject: string;
  body?: string;
  status: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
  sender: { id: string; email: string; name: string | null };
  stepCount?: number;
  messageCount: number;
  steps?: CampaignStep[];
  analytics?: CampaignAnalytics & { failureBreakdown?: Record<string, number> };
  events?: CampaignEvent[];
}

export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  attemptCount: number;
  campaign: { id: string; subject: string };
  sender: { id: string; email: string; name: string | null };
}

export interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  sentAt: string | null;
  messageId?: string;
  previewUrl?: string;
  campaign: { id: string; subject: string };
  sender: { id: string; email: string; name: string | null };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  scheduledCount: number;
  sentCount: number;
  failedCount: number;
  campaignCount: number;
  senderCount: number;
}

export interface CreateCampaignPayload {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  steps?: CreateCampaignStepInput[];
}

import { getApiBaseUrl } from '../lib/api-config';

// ─── Service ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const message =
      body?.error?.message || body?.message || `Request failed: ${response.status}`;
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).code = body?.error?.code;
    (err as any).details = body?.error?.details;
    throw err;
  }

  return response.json() as Promise<T>;
}

export const campaignService = {
  async list(page = 1, pageSize = 20): Promise<{ campaigns: Campaign[]; pagination: PaginationMeta }> {
    return apiFetch(`/api/campaigns?page=${page}&pageSize=${pageSize}`);
  },

  async get(id: string): Promise<{ campaign: Campaign }> {
    return apiFetch(`/api/campaigns/${id}`);
  },

  async create(payload: CreateCampaignPayload): Promise<{ campaignId: string; messageCount: number; scheduledCount: number; stepCount: number }> {
    return apiFetch('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancel(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/campaigns/${id}/cancel`, {
      method: 'POST',
    });
  },

  async getEvents(id: string, limit = 50): Promise<{ events: CampaignEvent[] }> {
    return apiFetch(`/api/campaigns/${id}/events?limit=${limit}`);
  },

  async getStats(): Promise<DashboardStats> {
    return apiFetch('/api/campaigns/stats');
  },

  async getScheduled(page = 1, pageSize = 25): Promise<{ emails: ScheduledEmail[]; pagination: PaginationMeta }> {
    return apiFetch(`/api/emails/scheduled?page=${page}&pageSize=${pageSize}`);
  },

  async getSent(page = 1, pageSize = 25): Promise<{ emails: SentEmail[]; pagination: PaginationMeta }> {
    return apiFetch(`/api/emails/sent?page=${page}&pageSize=${pageSize}`);
  },

  async searchSent(query: string, page = 1, pageSize = 25): Promise<{ emails: SentEmail[]; pagination: PaginationMeta }> {
    if (!query.trim()) {
      return this.getSent(page, pageSize);
    }
    const res = await apiFetch<any>(
      `/api/emails/search?q=${encodeURIComponent(query.trim())}&status=SENT&page=${page}&pageSize=${pageSize}`
    );
    // API returns { items, page, pageSize, total, totalPages }
    const rawItems: any[] = res.items ?? res.results ?? [];
    return {
      emails: rawItems.map((r: any) => ({
        id: r.id,
        recipient: r.recipient,
        subject: r.subject,
        status: r.status,
        sentAt: r.sentAt,
        messageId: r.messageId,
        previewUrl: r.previewUrl,
        campaign: { id: r.campaignId, subject: r.subject },
        sender: { id: r.senderId, email: r.senderEmail, name: null },
      })),
      pagination: {
        page: res.page || 1,
        pageSize: res.pageSize || pageSize,
        total: res.total || 0,
        totalPages: res.totalPages || 1,
      },
    };
  },
};

export const senderService = {
  async list(): Promise<{ senders: SenderAccount[] }> {
    return apiFetch('/api/senders');
  },

  async create(payload: { email: string; name?: string }): Promise<{ sender: SenderAccount }> {
    return apiFetch('/api/senders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getHealth(): Promise<{ senders: SenderHealthMetrics[] }> {
    return apiFetch('/api/senders/health');
  },
};

export interface QueueMetric {
  name: string;
  displayName: string;
  description: string;
  isPaused: boolean;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
}

export interface QueueMetricsResponse {
  timestamp: string;
  workerConcurrency: number;
  queues: QueueMetric[];
}

export const queueService = {
  async getMetrics(): Promise<QueueMetricsResponse> {
    return apiFetch('/api/admin/queues/metrics');
  },
};
