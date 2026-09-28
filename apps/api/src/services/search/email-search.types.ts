export interface IndexedEmailDocument {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  senderName: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageId: string | null;
  idempotencyKey: string;
}

export interface EmailSearchQuery {
  q?: string;
  userId?: string;
  campaignId?: string;
  senderId?: string;
  senderEmail?: string;
  recipient?: string;
  status?: string;
  dateField?: 'createdAt' | 'scheduledAt' | 'sentAt';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface EmailSearchResult {
  items: IndexedEmailDocument[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EmailIndexResult {
  id: string;
  action: 'created' | 'updated' | 'noop';
  version?: number;
}

export interface BulkIndexResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface ElasticsearchHealth {
  status: 'connected' | 'disconnected';
  clusterName?: string;
  version?: string;
  error?: string;
}
