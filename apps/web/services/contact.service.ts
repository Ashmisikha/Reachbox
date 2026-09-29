import { Contact, ContactImportSummary, ContactStatus } from '@reachinbox/shared';

export interface ListContactsParams {
  search?: string;
  tag?: string;
  status?: ContactStatus;
  page?: number;
  limit?: number;
}

export interface ListContactsResponse {
  success: boolean;
  data: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateContactPayload {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  tags?: string[];
  status?: ContactStatus;
}

export interface UpdateContactPayload {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  tags?: string[];
  status?: ContactStatus;
}

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
    (err as any).details = body?.error?.details;
    throw err;
  }

  return response.json() as Promise<T>;
}

export const contactService = {
  async getContacts(params?: ListContactsParams): Promise<ListContactsResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    return apiFetch<ListContactsResponse>(`/api/contacts${qs ? `?${qs}` : ''}`);
  },

  list(params?: ListContactsParams): Promise<ListContactsResponse> {
    return contactService.getContacts(params);
  },

  async getContact(id: string): Promise<{ success: boolean; data: Contact }> {
    return apiFetch<{ success: boolean; data: Contact }>(`/api/contacts/${id}`);
  },

  async createContact(payload: CreateContactPayload): Promise<{ success: boolean; data: Contact }> {
    return apiFetch<{ success: boolean; data: Contact }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateContact(id: string, payload: UpdateContactPayload): Promise<{ success: boolean; data: Contact }> {
    return apiFetch<{ success: boolean; data: Contact }>(`/api/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteContact(id: string): Promise<{ success: boolean; data: { id: string; deleted: boolean } }> {
    return apiFetch<{ success: boolean; data: { id: string; deleted: boolean } }>(`/api/contacts/${id}`, {
      method: 'DELETE',
    });
  },

  async bulkDelete(ids: string[]): Promise<{ success: boolean; data: { count: number } }> {
    return apiFetch<{ success: boolean; data: { count: number } }>('/api/contacts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async getTags(): Promise<{ success: boolean; data: string[] }> {
    return apiFetch<{ success: boolean; data: string[] }>('/api/contacts/tags');
  },

  async importCsv(
    csv: string,
    defaultTags?: string[]
  ): Promise<{ success: boolean; data: ContactImportSummary & { contacts: Contact[] } }> {
    return apiFetch<{ success: boolean; data: ContactImportSummary & { contacts: Contact[] } }>(
      '/api/contacts/import',
      {
        method: 'POST',
        body: JSON.stringify({ csv, defaultTags }),
      }
    );
  },
};
