import { FailureRecord, ApiResponse } from '@reachinbox/shared';
import { getApiBaseUrl } from '../lib/api-config';

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
    const message = body?.error?.message || body?.message || `Request failed: ${response.status}`;
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).code = body?.error?.code;
    throw err;
  }

  const json: ApiResponse<T> = await response.json();
  return json.data as T;
}

export interface ListFailuresResponse {
  failures: FailureRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RetryResult {
  success: boolean;
  messageId?: string;
  requestedCount?: number;
  retriedCount?: number;
  failedCount?: number;
}

export const failureService = {
  async list(search?: string, page = 1, limit = 50): Promise<ListFailuresResponse> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiFetch<ListFailuresResponse>(`/api/failures?${params.toString()}`);
  },

  async retrySingle(id: string): Promise<RetryResult> {
    return apiFetch<RetryResult>(`/api/failures/${id}/retry`, {
      method: 'POST',
    });
  },

  async retrySelected(messageIds: string[]): Promise<RetryResult> {
    return apiFetch<RetryResult>('/api/failures/retry-selected', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    });
  },

  async retryAll(campaignId?: string): Promise<RetryResult> {
    const path = campaignId ? `/api/failures/retry-all?campaignId=${campaignId}` : '/api/failures/retry-all';
    return apiFetch<RetryResult>(path, {
      method: 'POST',
    });
  },
};
