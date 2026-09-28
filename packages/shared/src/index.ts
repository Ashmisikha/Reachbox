/**
 * Shared types, constants, and utilities for ReachInbox Email Scheduler
 */

/**
 * Valid lifecycle states for email messages as defined in AGENTS.md §15
 */
export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export const EMAIL_STATUSES = {
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

/**
 * Explicit state machine transition map (AGENTS.md §15).
 * Enforces valid state transitions across workers and APIs.
 */
export const ALLOWED_EMAIL_TRANSITIONS: Record<EmailStatus, readonly EmailStatus[]> = {
  scheduled: ['processing', 'cancelled'],
  processing: ['sent', 'failed', 'cancelled'],
  sent: [], // Terminal successful state
  failed: ['scheduled', 'cancelled'], // Can be rescheduled on retry
  cancelled: [], // Terminal cancelled state
} as const;

export function isValidEmailStateTransition(current: EmailStatus, next: EmailStatus): boolean {
  const allowed = ALLOWED_EMAIL_TRANSITIONS[current];
  return allowed.includes(next);
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
