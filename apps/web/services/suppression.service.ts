import { Suppression, CreateSuppressionInput, ApiResponse } from '@reachinbox/shared';

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
    const message = body?.error?.message || body?.message || `Request failed: ${response.status}`;
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).code = body?.error?.code;
    throw err;
  }

  const json: ApiResponse<T> = await response.json();
  return json.data as T;
}

export interface ListSuppressionsResponse {
  suppressions: Suppression[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const suppressionService = {
  async list(search?: string, page = 1, limit = 50): Promise<ListSuppressionsResponse> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiFetch<ListSuppressionsResponse>(`/api/suppressions?${params.toString()}`);
  },

  async add(input: CreateSuppressionInput): Promise<Suppression> {
    return apiFetch<Suppression>('/api/suppressions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/suppressions/${id}`, {
      method: 'DELETE',
    });
  },

  async removeByEmail(email: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/suppressions/by-email/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  },
};
