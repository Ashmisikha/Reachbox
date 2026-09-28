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
  status: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
  sender: { id: string; email: string; name: string | null };
  messageCount: number;
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
}

// ─── Service ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
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

  async create(payload: CreateCampaignPayload): Promise<{ campaignId: string; messageCount: number; scheduledCount: number }> {
    return apiFetch('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    if (res.results) {
      return {
        emails: res.results.map((r: any) => ({
          id: r.id,
          recipient: r.recipient,
          subject: r.subject,
          status: r.status,
          sentAt: r.sentAt,
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
    }
    return res;
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
};

