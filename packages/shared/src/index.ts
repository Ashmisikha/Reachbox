/**
 * Shared types, constants, and utilities for ReachInbox Email Scheduler
 */

/**
 * Valid lifecycle states for email messages as defined in AGENTS.md §15 & Phase E
 */
export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'suppressed';

export const EMAIL_STATUSES = {
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SUPPRESSED: 'suppressed',
} as const;

/**
 * Explicit state machine transition map (AGENTS.md §15).
 * Enforces valid state transitions across workers and APIs.
 */
export const ALLOWED_EMAIL_TRANSITIONS: Record<EmailStatus, readonly EmailStatus[]> = {
  scheduled: ['processing', 'cancelled', 'suppressed'],
  processing: ['sent', 'failed', 'cancelled', 'suppressed'],
  sent: [], // Terminal successful state
  failed: ['scheduled', 'cancelled'], // Can be rescheduled on retry
  cancelled: [], // Terminal cancelled state
  suppressed: ['scheduled'], // Can be unsuppressed and rescheduled
} as const;

export function isValidEmailStateTransition(current: EmailStatus, next: EmailStatus): boolean {
  const allowed = ALLOWED_EMAIL_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services?: {
    database?: 'connected' | 'disconnected' | 'unknown';
    redis?: 'connected' | 'disconnected' | 'unknown';
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

export type ContactStatus = 'ACTIVE' | 'ARCHIVED' | 'UNSUBSCRIBED' | 'BOUNCED';

export interface Contact {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  tags: string[];
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContactImportSummary {
  imported: number;
  skipped: number;
  duplicates: number;
  invalid: number;
  totalRows: number;
}

/**
 * Phase B: Templates & Personalization
 */
export const SUPPORTED_PERSONALIZATION_VARIABLES = [
  'firstName',
  'lastName',
  'company',
  'jobTitle',
  'email',
] as const;

export type PersonalizationVariable = typeof SUPPORTED_PERSONALIZATION_VARIABLES[number];

export interface EmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  subject: string;
  body: string;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
}

/**
 * Phase C: Campaign Events & Analytics
 */
export interface CampaignEvent {
  id: string;
  campaignId: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CampaignAnalytics {
  totalRecipients: number;
  scheduled: number;
  waiting: number;
  delayed: number;
  active: number;
  sent: number;
  failed: number;
  cancelled: number;
  suppressed: number;
  completionRate: number;
  deliveryRate: number;
  failureRate: number;
}

/**
 * Phase D: Multi-Step Sequences
 */
export interface CampaignStep {
  id: string;
  campaignId: string;
  stepOrder: number;
  delayDays: number;
  delayHours: number;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignStepInput {
  stepOrder: number;
  delayDays: number;
  delayHours: number;
  subject: string;
  body: string;
}

/**
 * Phase E: Suppression
 */
export interface Suppression {
  id: string;
  userId: string;
  email: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSuppressionInput {
  email: string;
  reason?: string;
}

/**
 * Phase F: Failure & Retry Center
 */
export interface FailureRecord {
  id: string;
  campaignId: string;
  campaignName: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  error: string | null;
  isPermanent: boolean;
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  status: EmailStatus;
}

/**
 * Phase G: Sender Operations & Health
 */
export interface SenderHealthMetrics {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'RATE_LIMITED' | 'ERROR';
  hourlyLimit: number;
  sentThisHour: number;
  remainingCapacity: number;
  failedCount: number;
  rateLimitEventsCount: number;
  lastSentAt: string | null;
}
