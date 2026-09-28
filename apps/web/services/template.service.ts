import {
  EmailTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  ApiResponse,
} from '@reachinbox/shared';

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

export interface ListTemplatesResponse {
  templates: EmailTemplate[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PreviewTemplateResponse {
  previewSubject: string;
  previewBody: string;
  usedVariables: string[];
  missingVariables: string[];
  context: Record<string, unknown>;
}

export const templateService = {
  async list(search?: string, page = 1, limit = 50): Promise<ListTemplatesResponse> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiFetch<ListTemplatesResponse>(`/api/templates?${params.toString()}`);
  },

  async get(id: string): Promise<EmailTemplate> {
    return apiFetch<EmailTemplate>(`/api/templates/${id}`);
  },

  async create(input: CreateTemplateInput): Promise<EmailTemplate> {
    return apiFetch<EmailTemplate>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateTemplateInput): Promise<EmailTemplate> {
    return apiFetch<EmailTemplate>(`/api/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  },

  async duplicate(id: string): Promise<EmailTemplate> {
    return apiFetch<EmailTemplate>(`/api/templates/${id}/duplicate`, {
      method: 'POST',
    });
  },

  async preview(payload: {
    subject: string;
    body: string;
    contactId?: string;
    sampleData?: Record<string, string>;
  }): Promise<PreviewTemplateResponse> {
    return apiFetch<PreviewTemplateResponse>('/api/templates/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
