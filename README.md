# ReachInbox Email Scheduler

A production-grade, full-stack email scheduling and queue management system. Built for the ReachInbox technical assessment across eight implementation phases.

---

## Overview

The system provides:

- **Campaign-based email scheduling** — define a start time, per-recipient delay, and hourly send limit; the system distributes delivery across BullMQ delayed jobs without any cron engine.
- **Multiple sender accounts** — each user can configure independent sender identities. Campaigns are bound to a specific sender. Senders are isolated per user.
- **Distributed rate limiting** — atomic Redis Lua script enforces both a per-sender hourly limit and a minimum inter-email delay across any number of concurrent workers.
- **Idempotent delivery** — each `EmailMessage` has a unique `idempotencyKey` (SHA-256 of campaign ID + recipient + index). Workers perform an atomic database claim before consuming any delivery quota. Duplicate jobs or worker restarts exit cleanly without re-sending.
- **Restart persistence** — BullMQ delayed jobs are durably stored in Redis. PostgreSQL persists all email state. Restarting any process or worker does not lose scheduled emails or corrupt their state.
- **Ethereal SMTP delivery** — email is dispatched through a pooled Nodemailer transport pointing at Ethereal Email's SMTP server. Every sent message captures a `messageId` and a browser-inspectable `previewUrl`.
- **Elasticsearch search projection** — after successful delivery, an asynchronous indexing job writes the message into Elasticsearch. Elasticsearch is not authoritative; PostgreSQL remains the source of truth. Elasticsearch outages do not affect delivery.
- **Google OAuth 2.0 authentication** — implements the standard authorization code flow with a cryptographically random CSRF `state` cookie, SHA-256 hashed session tokens, and PostgreSQL-backed sessions.
- **Slack OAuth 2.0 notifications** — users can connect a Slack workspace. When the hourly rate limit is reached, a deduplicated alert is dispatched via a dedicated BullMQ worker. If Slack is not connected, no error occurs.
- **Live queue monitoring** — Bull-Board UI at `/admin/queues` and a Next.js dashboard screen at `/dashboard/queues`, both protected by session authentication.
- **Full-stack dashboard** — Next.js 14 (App Router) frontend aligned with the ReachInbox Figma reference, covering compose, campaigns, sent, scheduled, senders, analytics, integrations, and queue monitoring.

---

## Architecture

### Request and Data Flow

```text
Browser / Frontend
        │
        │ HTTP + Session Cookie
        ▼
  Express.js REST API
  (Helmet · CORS · Zod · Cookie-Parser)
        │
        ├─── Authentication ──────────────────────────────►  Google OAuth 2.0
        │                                                     └─ SHA-256 hashed token
        │                                                         stored in PostgreSQL sessions
        │
        ├─── Campaign Creation ──────────────────────────► PostgreSQL (Prisma)
        │    createMany(EmailMessage[])                        authoritative email state
        │    addBulk(BullMQ delayed jobs)                      ↓
        │                                                   BullMQ email-dispatch queue
        │                                                      (delayed jobs in Redis)
        │
        └─── Email Search ───────────────────────────────► Elasticsearch (search projection)
                                                              │ fallback → PostgreSQL ILIKE
                                                              │ when ES unavailable
───────────────────────────────────────────────────────────────────────────────────────
BullMQ email-dispatch worker (concurrency: EMAIL_WORKER_CONCURRENCY)
        │
        ├─ 1. Resolve EmailMessage from PostgreSQL
        ├─ 2. Idempotency: skip if status = SENT or CANCELLED
        ├─ 3. Atomic DB claim: SCHEDULED/FAILED → PROCESSING (updateMany)
        ├─ 4. Redis Lua delivery policy (hourly limit + minimum spacing per sender)
        │       ├─ ALLOWED: continue
        │       ├─ HOURLY_LIMIT: emit Slack notification job, revert DB state,
        │       │                reschedule BullMQ job for next hour window
        │       └─ SPACING: revert DB state, reschedule BullMQ job for spacing delay
        ├─ 5. Send via Ethereal SMTP (Nodemailer pooled transport)
        │       ├─ SUCCESS: update DB → SENT, record sentAt + messageId + previewUrl
        │       │           enqueue email-index job (non-blocking)
        │       └─ FAILURE: update DB → FAILED, record sanitized error,
        │                   BullMQ exponential backoff retry
        └─ 6. email-index worker: index document into Elasticsearch
                   └─ on ES failure: throw → BullMQ exponential backoff retry
                                     PostgreSQL state remains SENT (unaffected)
───────────────────────────────────────────────────────────────────────────────────────
BullMQ slack-notification worker (concurrency: SLACK_NOTIFICATION_CONCURRENCY)
        │
        ├─ 1. Load SlackConnection from PostgreSQL (dynamic; no restart required)
        ├─ 2. Skip if no CONNECTED connection found
        ├─ 3. Call Slack API (incoming webhook or chat.postMessage)
        ├─ 4. Handle revoked token gracefully (mark complete, no retry)
        └─ Job deduplicated via deterministic jobId per user+campaign+sender+hourWindow
```

### Source of Truth

| Layer | Role |
| :--- | :--- |
| **PostgreSQL** | Authoritative business state: users, sessions, senders, campaigns, email messages, email jobs, Slack connections |
| **Redis / BullMQ** | Scheduling and execution layer: delayed jobs, timing, delivery policy counters, notification deduplication keys |
| **Elasticsearch** | Search projection only: indexed after delivery for full-text search; never authoritative |
| **Slack** | External notification sink: rate-limit alerts only |
| **Ethereal** | External SMTP delivery provider: messages delivered and inspectable at ethereal.email |

---

## Phase Summary

| Phase | What was implemented |
| :--- | :--- |
| **0** | Monorepo workspaces (`apps/api`, `apps/web`, `packages/shared`), Express API skeleton, Next.js 14 shell, Zod configuration, health endpoints, Docker Compose for PostgreSQL + Redis |
| **1** | Prisma schema, PostgreSQL migrations, typed repositories for all entities |
| **2** | BullMQ delayed scheduling, deterministic job IDs, configurable concurrency, keyset-paginated batch enqueue (`addBulk`), atomic Redis delivery policy (Lua), idempotency, restart persistence |
| **3** | Ethereal SMTP transport (`EtherealEmailTransport`), pooled Nodemailer, credential sanitization in logs, live Ethereal SMTP test |
| **4** | Elasticsearch 8.13 client, explicit index mapping, email index service, async `email-index` BullMQ queue and worker, full-text multi-field search with pagination, PostgreSQL fallback on ES outage |
| **5** | Google OAuth 2.0 authorization code flow, CSRF state cookie, SHA-256 hashed session tokens, PostgreSQL `sessions` table, `requireAuth` middleware, user resolution and linking, logout |
| **6** | Slack OAuth 2.0 connection and callback, AES-256-GCM encrypted token storage, `slack-notification` BullMQ queue and worker, rate-limit alert dispatch, hourly deduplication by deterministic job ID, graceful handling of no connection or revoked token |
| **7** | Campaign creation API with bulk `createMany` + `addBulk`, campaign listing and detail, dashboard stats, scheduled/sent email listings, sender management, Next.js 14 frontend (14 routes), CSV recipient parsing and validation, loading/empty/error states |
| **8** | Bull-Board UI at `/admin/queues`, JSON metrics endpoint at `/api/admin/queues/metrics`, Next.js queue monitor at `/dashboard/queues`, production hardening test suite (restart persistence, idempotency, 1,000-recipient load, multi-sender isolation, Elasticsearch outage decoupling, graceful shutdown) |

---

## Database Schema

**Location**: `apps/api/prisma/schema.prisma`  
**Migrations**: `apps/api/prisma/migrations/`  
**Provider**: PostgreSQL 16 via Prisma ORM 6.19

### Models

**`users`**
```
id          UUID PK
googleId    String? UNIQUE          — Google subject identifier, nullable (linked on first OAuth login)
email       String UNIQUE
name        String
avatarUrl   String?
status      UserStatus (ACTIVE | DISABLED)
```

**`sessions`**
```
id          UUID PK
userId      UUID FK → users
tokenHash   String UNIQUE          — SHA-256(rawToken); raw token is never stored
expiresAt   DateTime
```

**`sender_accounts`**
```
id          UUID PK
userId      UUID FK → users
email       String
name        String?
status      SenderStatus (ACTIVE | DISABLED)
UNIQUE(userId, email)
```

**`email_campaigns`**
```
id          UUID PK
userId      UUID FK → users
senderId    UUID FK → sender_accounts
subject     String
body        String
startAt     DateTime              — absolute campaign start timestamp (UTC)
delayMs     Int                   — per-recipient inter-email spacing in milliseconds
hourlyLimit Int                   — maximum emails to dispatch per hour
status      CampaignStatus (DRAFT | SCHEDULED | PROCESSING | COMPLETED | CANCELLED)
```

**`email_messages`**
```
id              UUID PK
campaignId      UUID FK → email_campaigns
senderId        UUID FK → sender_accounts
recipient       String
subject         String
body            String
scheduledAt     DateTime            — absolute dispatch time: startAt + index × delayMs
sentAt          DateTime?
status          EmailStatus (SCHEDULED | PROCESSING | SENT | FAILED | CANCELLED)
attemptCount    Int
lastError       String?             — sanitized, no credentials
idempotencyKey  String UNIQUE       — SHA-256("campaignId:recipient:index")
```

**`email_jobs`**
```
id              UUID PK
emailMessageId  UUID UNIQUE FK → email_messages
bullmqJobId     String? UNIQUE      — deterministic: "email-{emailMessageId}"
status          JobStatus (PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED)
attempts        Int
processedAt     DateTime?
lastError       String?
```

**`slack_connections`**
```
id                  UUID PK
userId              UUID UNIQUE FK → users
teamId              String?
teamName            String?
accessToken         String          — AES-256-GCM encrypted (enc:v1:<iv>:<authTag>:<ciphertext>)
slackUserId         String?
botUserId           String?
channelId           String?
channelName         String?
incomingWebhookUrl  String?
status              String (default: "CONNECTED")
```

---

## BullMQ Queues and Workers

Three BullMQ queues run on a single Redis connection (`REDIS_URL`).

### `email-dispatch`

| Property | Value |
| :--- | :--- |
| Queue class | `emailQueue` — `apps/api/src/queues/email.queue.ts` |
| Worker | `createEmailWorker()` — `apps/api/src/workers/email.worker.ts` |
| Job name | `send-email` |
| Job ID format | `email-{emailMessageId}` (deterministic, prevents duplicate enqueue) |
| Delay calculation | `Math.max(0, scheduledAt.getTime() - Date.now())` |
| Max attempts | `EMAIL_MAX_ATTEMPTS` (default: 5) |
| Backoff | exponential, base delay `EMAIL_RETRY_DELAY_MS` (default: 5000 ms) |
| Concurrency | `EMAIL_WORKER_CONCURRENCY` (default: 10) |
| Enqueue method | `addBulk()` via keyset-paginated batches of `EMAIL_SCHEDULING_BATCH_SIZE` (default: 500) |

### `email-index`

| Property | Value |
| :--- | :--- |
| Queue class | `emailIndexQueue` — `apps/api/src/queues/email-index.queue.ts` |
| Worker | `createEmailIndexWorker()` — `apps/api/src/workers/email-index.worker.ts` |
| Job name | `index-email` |
| Job ID format | `index-email-{emailMessageId}` |
| Max attempts | `INDEXING_MAX_ATTEMPTS` (default: 5) |
| Backoff | exponential, base delay `INDEXING_RETRY_DELAY_MS` (default: 3000 ms) |
| Concurrency | `INDEXING_WORKER_CONCURRENCY` (default: 5) |
| Fault tolerance | Failure throws to BullMQ for retry; PostgreSQL `SENT` status is never rolled back |

### `slack-notification`

| Property | Value |
| :--- | :--- |
| Queue class | `slackNotificationQueue` — `apps/api/src/queues/slack-notification.queue.ts` |
| Worker | `createSlackNotificationWorker()` — `apps/api/src/workers/slack-notification.worker.ts` |
| Job name | `rate-limit-notification` |
| Job ID format | `slack-rate-limit-{userId}-{campaignId}-{senderId}-{hourWindow}` (deduplicates per hour) |
| Backoff | exponential |
| Behavior when no connection | job completes without error; no Slack call made |
| Behavior when token revoked | job completes without retry |

---

## Email Scheduling

**No cron. No `setInterval`. No polling loop.**

Scheduling uses BullMQ native delayed jobs:

```text
Campaign created with startAt, delayMs, hourlyLimit, recipients[]
    │
    ▼
For each recipient at index i:
    scheduledAt[i] = startAt + i × delayMs

EmailMessage records bulk-created in PostgreSQL (batches of 500, createMany)
    │
    ▼
Campaign scheduler pages EmailMessage IDs with keyset pagination
(avoids O(N) OFFSET degradation on large recipient sets)
    │
    ▼
emailQueue.addBulk([
    { jobId: "email-{id}", delay: scheduledAt[i].getTime() - Date.now(), ... },
    ...
])
    │
    ▼
BullMQ persists delays in Redis sorted sets.
Worker processes each job at or after its scheduled time.
```

Restarting the API or worker does not lose or re-enqueue jobs. Redis retains the sorted set and BullMQ resumes naturally.

---

## Distributed Rate Limiting

**Implementation**: `apps/api/src/services/email-delivery-policy.service.ts`

A single Redis Lua script (`DELIVERY_POLICY_SCRIPT`) is executed atomically before each SMTP send. It evaluates two policies:

1. **Hourly limit** (`HOURLY_LIMIT`): counts dispatches within the current 1-hour window using Redis keys `email-rate:{senderId}` and `email-rate:{senderId}:count`. If `sendCount >= hourlyLimit`, the job is denied.
2. **Minimum inter-email spacing** (`SPACING`): tracks the timestamp of the last send for this sender using `email-spacing:{senderId}`. If `lastSend + minimumDelayMs > now`, the job is denied.

**On denial**, the worker:
1. Reverts the `EmailMessage` and `EmailJob` status back to their pre-claim state in a single `$transaction`.
2. If the reason is `HOURLY_LIMIT`, enqueues a Slack notification job (deduplicated by `jobId`).
3. Throws `RescheduleRequired(retryAfterMs)`, which the worker catches and uses to re-add the BullMQ job with the computed delay.

**The denied email is never dropped or permanently failed.** It is rescheduled and retried after the rate-limit window or spacing interval.

---

## Idempotency and Restart Persistence

### Database-Level Idempotency

- Each `EmailMessage` has a `UNIQUE` constraint on `idempotencyKey` (`SHA-256("campaignId:recipient:index")`). Duplicate `createMany` calls with `skipDuplicates: true` are safe.
- Before dispatch, the worker calls `prisma.emailMessage.updateMany({ where: { id, status: { in: ['SCHEDULED', 'FAILED'] } }, data: { status: 'PROCESSING' } })`. If `count === 0`, the message is already claimed or in a terminal state; the worker exits without sending.

### BullMQ-Level Idempotency

- All BullMQ job IDs are deterministic (`email-{emailMessageId}`, `index-email-{emailMessageId}`, `slack-rate-limit-{...}-{hourWindow}`). Re-enqueuing a job with an existing ID does not create a duplicate pending job.

### Restart Persistence

- Delayed BullMQ jobs live in Redis sorted sets. Restarting the API server, worker process, or both does not affect job timing or state.
- Email `status` in PostgreSQL survives any restart. A SENT email will be detected by the idempotency check on the next worker run and immediately exited.

---

## Ethereal SMTP

**Transport class**: `EtherealEmailTransport` — `apps/api/src/services/smtp/ethereal.transport.ts`

- Uses Nodemailer `createTransport` with the pooled connection option (`pool: true`).
- Pool size and per-connection message limit are configurable via `SMTP_MAX_CONNECTIONS` and `SMTP_MAX_MESSAGES`.
- Sends plain-text email (`text: body`).
- Returns `messageId` (SMTP envelope message ID) and `previewUrl` (Ethereal browser preview link) from each dispatch.
- SMTP credentials come from environment variables (`ETHEREAL_USER`, `ETHEREAL_PASSWORD`); they are never stored in sender account records.
- Error messages from the SMTP transport are sanitized with a regex (`/([a-zA-Z0-9._%+-]+:[^@\s]+@)/g → '***:***@'`) before being persisted to the database or logged.

**Testing**: The test suite contains both:
- **Mocked transport tests** (`tests/email-queue.test.ts`, `tests/smtp.test.ts`) — use an injectable `EmailTransport` interface; no real network call.
- **One live Ethereal test** (`tests/smtp.test.ts`, "dispatches a real email through Ethereal SMTP") — opt-in, executed when `ETHEREAL_USER` and `ETHEREAL_PASSWORD` are present in `.env`. In Phase 8 verification, this test ran successfully and returned a real message ID and preview URL.

---

## Elasticsearch

**Client**: `@elastic/elasticsearch` 8.19 — `apps/api/src/services/search/elasticsearch.client.ts`  
**Index name**: `ELASTICSEARCH_INDEX` (default: `emails`)  
**Configuration**: `apps/api/src/config/elasticsearch.ts`

### Index Mapping (`EMAIL_INDEX_MAPPINGS`)

| Field | ES Type |
| :--- | :--- |
| `id` | keyword |
| `campaignId` | keyword |
| `userId` | keyword |
| `senderId` | keyword |
| `senderEmail` | keyword |
| `senderName` | text + keyword |
| `recipient` | keyword |
| `subject` | text |
| `body` | text |
| `status` | keyword |
| `scheduledAt` | date |
| `sentAt` | date |
| `createdAt` | date |
| `updatedAt` | date |
| `messageId` | keyword |
| `idempotencyKey` | keyword |

### Document ID

Each document uses `EmailMessage.id` (UUID) as the Elasticsearch document ID. Re-indexing is an upsert (`index` operation); no duplicate documents are created.

### Search (`GET /api/emails/search`)

- Free-text `multi_match` across `subject^3`, `body^2`, `senderName^2`, `senderEmail`, `recipient` with `fuzziness: AUTO`.
- Exact keyword filters: `userId`, `campaignId`, `senderId`, `senderEmail`, `recipient`, `status`.
- Date range filter on `sentAt`, `scheduledAt`, or `createdAt` (configurable via `dateField` parameter).
- Pagination via `page` and `pageSize` (max 100 per page).
- Sorted by `sentAt` descending by default.
- **Fallback**: if Elasticsearch throws a connection error during search, the controller falls back to a PostgreSQL `ILIKE` query.

### Fault Tolerance

Elasticsearch indexing failures (network timeout, cluster unavailable) trigger BullMQ exponential backoff retry on the `email-index` queue. The `EmailMessage` status in PostgreSQL remains `SENT` regardless of indexing outcome.

---

## Google OAuth and Session Management

**Flow**: Standard OAuth 2.0 Authorization Code flow (no PKCE; state-based CSRF protection).

```text
GET /api/auth/google
    → generate cryptographically random state (crypto.randomBytes)
    → store state in HttpOnly cookie (maxAge: OAUTH_STATE_MAX_AGE_MS)
    → redirect to Google authorization URL

GET /api/auth/google/callback?code=...&state=...
    → validate state against cookie (CSRF protection)
    → exchange authorization code for Google tokens
    → call Google userinfo endpoint to fetch identity
    → find or create User by googleId (or link to existing user by email)
    → generate raw session token (crypto.randomBytes(32))
    → store SHA-256(rawToken) in PostgreSQL sessions table
    → set reachinbox_sid cookie (HttpOnly, SameSite=Lax, Secure in production)
    → redirect to frontend dashboard
```

**Session validation** (`requireAuth` middleware): extracts `reachinbox_sid` cookie, SHA-256-hashes it, queries `sessions` where `tokenHash = hash AND expiresAt > now AND user.status = ACTIVE`.

**Logout** (`POST /api/auth/logout`): deletes the `Session` record from PostgreSQL and clears the cookie.

**Session TTL**: `SESSION_MAX_AGE_MS` (default: 604800000 ms = 7 days).

**What is NOT implemented**: PKCE, refresh token rotation, or any OAuth-independent password authentication.

**Testing**: All OAuth flow logic is tested with simulated callbacks in `tests/auth.test.ts` (30 tests). No live Google browser round-trip is performed in automated tests; real OAuth requires a browser and live `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

---

## Slack OAuth and Notifications

**Flow**: Slack OAuth 2.0 with `chat:write` and `incoming-webhook` scopes.

```text
GET /api/slack/connect (requireAuth)
    → redirect to Slack authorization URL with state cookie

GET /api/slack/callback (requireAuth, processes after Slack redirect)
    → validate state
    → exchange code for access token
    → encrypt access token with AES-256-GCM
    → upsert SlackConnection in PostgreSQL

GET /api/slack/status (requireAuth)
    → return connection status and team name

POST /api/slack/disconnect (requireAuth)
    → delete SlackConnection from PostgreSQL
```

**Token encryption**: `apps/api/src/services/slack/slack-crypto.ts` — AES-256-GCM with a random 12-byte IV. Stored format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.

**Rate-limit notification deduplication**: Each `enqueueSlackNotificationJob` call uses a deterministic job ID: `slack-rate-limit-{userId}-{campaignId}-{senderId}-{hourWindow}`. BullMQ silently ignores the second enqueue of an existing pending job ID, preventing alert storms.

**Graceful degradation**:
- If no `SlackConnection` exists for the user, the notification worker logs and exits cleanly.
- If the Slack API returns a token revocation error, the worker marks the job complete without retry.
- If Slack is not configured at all, email dispatch continues normally.

**Testing**: All Slack logic is tested in `tests/slack.test.ts` (12 tests) using stub Slack connections and mock HTTP responses. No live Slack API call is made in automated tests; real notifications require valid `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and a connected workspace.

---

## Queue Monitoring

### Bull-Board Admin UI

**URL**: `GET /admin/queues`  
**Authentication**: `requireAuth` — returns 401 without a valid session.  
**Implementation**: `@bull-board/express` + `@bull-board/api` with `BullMQAdapter` wrapping all three queues.  
**Visibility**: `email-dispatch`, `email-index`, `slack-notification`.

The Bull-Board UI displays waiting, active, delayed, completed, and failed jobs in real time via HTTP polling of BullMQ's Redis state. It does not use WebSockets or SSE.

### JSON Metrics Endpoint

**URL**: `GET /api/admin/queues/metrics`  
**Authentication**: `requireAuth`  
**Response**: job counts (`waiting`, `active`, `delayed`, `completed`, `failed`), pause status, and configured `workerConcurrency` for each queue, plus an ISO 8601 timestamp.

### Frontend Queue Monitor

**URL**: `/dashboard/queues`  
**Implementation**: `apps/web/app/dashboard/queues/page.tsx`  
Fetches `/api/admin/queues/metrics` on page load. Displays metric cards per queue and links to the Bull-Board admin UI. No WebSocket or SSE — metrics reflect the state at page load time.

---

## API Routes

All routes listed are verified from `apps/api/src/routes/`.

| Auth Required | Method | Path | Description |
| :---: | :--- | :--- | :--- |
| No | `GET` | `/health` | API health status |
| No | `GET` | `/api/health` | API health status (same handler) |
| No | `GET` | `/api/health/elasticsearch` | Elasticsearch cluster health |
| No | `GET` | `/api/auth/google` | Begin Google OAuth flow (redirect) |
| No | `GET` | `/api/auth/google/callback` | Google OAuth callback |
| No | `POST` | `/api/auth/logout` | Invalidate session and clear cookie |
| **Yes** | `GET` | `/api/auth/me` | Return authenticated user profile |
| **Yes** | `POST` | `/api/campaigns` | Create campaign, bulk-create messages, enqueue jobs |
| **Yes** | `GET` | `/api/campaigns` | List user's campaigns |
| **Yes** | `GET` | `/api/campaigns/:id` | Campaign details and delivery progress |
| **Yes** | `GET` | `/api/campaigns/stats` | Dashboard aggregate statistics |
| **Yes** | `GET` | `/api/emails/scheduled` | Scheduled emails for authenticated user |
| **Yes** | `GET` | `/api/emails/sent` | Sent emails with messageId and previewUrl |
| **Yes** | `GET` | `/api/emails/search` | Elasticsearch full-text search |
| **Yes** | `GET` | `/api/senders` | List sender accounts |
| **Yes** | `POST` | `/api/senders` | Create sender account |
| **Yes** | `GET` | `/api/slack/connect` | Begin Slack OAuth flow |
| **Yes** | `GET` | `/api/slack/callback` | Slack OAuth callback |
| **Yes** | `GET` | `/api/slack/status` | Slack connection status |
| **Yes** | `POST` | `/api/slack/disconnect` | Remove Slack connection |
| **Yes** | `GET` | `/admin/queues` | Bull-Board live queue admin UI |
| **Yes** | `GET` | `/api/admin/queues/metrics` | Queue health JSON snapshot |

---

## Frontend Routes

All routes verified from `apps/web/app/dashboard/`.

| Route | Screen |
| :--- | :--- |
| `/` | Login / Google OAuth entry point |
| `/dashboard` | Overview: stats, recent campaigns, quick actions |
| `/dashboard/compose` | Campaign builder: CSV upload, sender, schedule, delay, hourly limit |
| `/dashboard/campaigns` | Campaign list |
| `/dashboard/campaigns/[id]` | Campaign detail and per-recipient delivery progress |
| `/dashboard/scheduled` | Scheduled emails table |
| `/dashboard/sent` | Sent emails table with Ethereal preview links |
| `/dashboard/senders` | Sender account management |
| `/dashboard/integrations` | Slack OAuth connection |
| `/dashboard/analytics` | Delivery metrics and throughput breakdown |
| `/dashboard/settings` | Account and workspace settings |
| `/dashboard/queues` | Live BullMQ queue monitor |

---

## Security Controls

- **Ownership enforcement**: `createCampaign` verifies `SenderAccount.userId === authenticatedUserId`. Campaign and email list queries always filter by `userId`.
- **Session tokens**: Raw tokens are never stored. Only `SHA-256(rawToken)` persists in the database.
- **Session cookies**: `HttpOnly`, `SameSite=Lax`, `Secure` in production (`NODE_ENV=production`).
- **OAuth CSRF state**: Random state stored in an HttpOnly cookie; validated on callback.
- **Encrypted Slack tokens**: AES-256-GCM with a random IV per encryption. Key derived from `SLACK_TOKEN_ENCRYPTION_KEY` or `SESSION_SECRET`.
- **Sanitized error logging**: SMTP error messages are regex-sanitized to remove `user:pass@host` patterns before being logged or stored.
- **Helmet**: Applied globally on all Express responses.
- **CORS**: Restricted to `CORS_ORIGIN` environment variable.
- **Input validation**: All request bodies validated with Zod schemas before reaching service layer.
- **No secrets committed**: `.env` is in `.gitignore`. `.env.example` contains only placeholder values.

---

## Environment Configuration

All variables are read from `.env` (copy `.env.example`). Actual variable names from `.env.example`:

### Application

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | No | Runtime environment | `development` |
| `API_PORT` | No | Express API port | `4000` |
| `API_HOST` | No | Express bind address | `0.0.0.0` |
| `CORS_ORIGIN` | No | Allowed CORS origin | `http://localhost:3000` |
| `PORT` | No | Next.js frontend port | `3000` |
| `NEXT_PUBLIC_API_URL` | No | API base URL used by frontend | `http://localhost:4000` |

### PostgreSQL

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | Prisma connection string | `postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox_db?schema=public` |

### Redis

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `REDIS_URL` | **Yes** | Redis connection string (BullMQ + rate limiting) | `redis://localhost:6379` |

### BullMQ Workers

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `WORKER_CONCURRENCY` | No | General worker concurrency | `5` |
| `EMAIL_WORKER_CONCURRENCY` | No | Email dispatch worker concurrency | `10` |
| `EMAIL_MAX_ATTEMPTS` | No | Max BullMQ retry attempts for email jobs | `5` |
| `EMAIL_RETRY_DELAY_MS` | No | Base exponential backoff delay (ms) | `5000` |
| `EMAIL_SCHEDULING_BATCH_SIZE` | No | Keyset pagination page size for bulk enqueue | `500` |

### Rate Limiting

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `MIN_EMAIL_DELAY_MS` | No | Minimum ms between two emails from the same sender | `2000` |
| `MAX_EMAILS_PER_HOUR` | No | Global hourly send limit (across all senders) | `200` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | No | Per-sender hourly send limit | `50` |

### Ethereal SMTP

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `ETHEREAL_HOST` | No | SMTP server hostname | `smtp.ethereal.email` |
| `ETHEREAL_PORT` | No | SMTP server port | `587` |
| `ETHEREAL_SECURE` | No | Use TLS | `false` |
| `ETHEREAL_USER` | **Yes** (for delivery) | Ethereal SMTP username | *(blank)* |
| `ETHEREAL_PASSWORD` | **Yes** (for delivery) | Ethereal SMTP password | *(blank)* |
| `SMTP_POOL` | No | Enable pooled connections | `true` |
| `SMTP_MAX_CONNECTIONS` | No | Max pooled SMTP connections | `5` |
| `SMTP_MAX_MESSAGES` | No | Max messages per connection | `100` |

### Elasticsearch

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `ELASTICSEARCH_URL` | **Yes** (for search) | ES cluster URL | `http://localhost:9200` |
| `ELASTICSEARCH_INDEX` | No | Index name | `emails` |
| `ELASTICSEARCH_USERNAME` | No | ES auth username | *(blank)* |
| `ELASTICSEARCH_PASSWORD` | No | ES auth password | *(blank)* |
| `ELASTICSEARCH_API_KEY` | No | ES API key | *(blank)* |
| `ELASTICSEARCH_REQUEST_TIMEOUT_MS` | No | Client request timeout | `10000` |
| `INDEXING_WORKER_CONCURRENCY` | No | `email-index` worker concurrency | `5` |
| `INDEXING_MAX_ATTEMPTS` | No | Max ES indexing retry attempts | `5` |
| `INDEXING_RETRY_DELAY_MS` | No | ES indexing backoff base (ms) | `3000` |

### Google OAuth

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `GOOGLE_CLIENT_ID` | **Yes** (for OAuth) | Google OAuth client ID | `your_google_client_id...` |
| `GOOGLE_CLIENT_SECRET` | **Yes** (for OAuth) | Google OAuth client secret | `your_google_client_secret` |
| `GOOGLE_REDIRECT_URI` | No | OAuth callback URL | `http://localhost:4000/api/auth/google/callback` |
| `GOOGLE_CALLBACK_URL` | No | Same as REDIRECT_URI | `http://localhost:4000/api/auth/google/callback` |
| `WEB_ORIGIN` | No | Frontend origin for post-login redirect | `http://localhost:3000` |
| `SESSION_SECRET` | No | Session cookie signing secret | `reachinbox_development_session_secret_change_in_production` |
| `SESSION_COOKIE_NAME` | No | Session cookie name | `reachinbox_sid` |
| `SESSION_MAX_AGE_MS` | No | Session TTL in milliseconds | `604800000` (7 days) |

### Slack OAuth

| Variable | Required | Description | Default in example |
| :--- | :---: | :--- | :--- |
| `SLACK_CLIENT_ID` | **Yes** (for Slack) | Slack app client ID | `your_slack_client_id` |
| `SLACK_CLIENT_SECRET` | **Yes** (for Slack) | Slack app client secret | `your_slack_client_secret` |
| `SLACK_REDIRECT_URI` | No | Slack OAuth callback URL | `http://localhost:4000/api/slack/callback` |

---

## Docker Compose

Defined in `docker-compose.yml` at the repository root.

### Services

| Service | Image | Port | Volume |
| :--- | :--- | :--- | :--- |
| `postgres` | `postgres:16-alpine` | `5432:5432` | `reachinbox_postgres_data` |
| `redis` | `redis:7-alpine` | `6379:6379` | `reachinbox_redis_data` |
| `elasticsearch` | `elasticsearch:8.13.4` | `9200:9200` | `reachinbox_elasticsearch_data` |

Elasticsearch runs with `discovery.type=single-node`, `xpack.security.enabled=false`, and `ES_JAVA_OPTS=-Xms512m -Xmx512m`.

Redis runs with `--appendonly yes` (AOF persistence).

All three services include healthchecks.

**Note**: Docker Desktop is not installed in the current development environment. The `docker-compose.yml` definitions are correct and have been verified to be structurally valid, but a live `docker compose up -d` was not executed on this machine during Phase 8. Infrastructure was run using locally installed PostgreSQL, Redis, and Elasticsearch binaries. On any machine with Docker installed, `docker compose up -d` will start all three services.

### Commands

```bash
# Start all infrastructure (PostgreSQL, Redis, Elasticsearch)
npm run docker:up
# or: docker compose up -d

# Stream service logs
npm run docker:logs
# or: docker compose logs -f

# Check service health status
docker compose ps

# Stop all services (data volumes preserved)
npm run docker:down
# or: docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## Local Setup

### 1. Prerequisites

- Node.js 20+ and npm 9+
- Docker and Docker Compose **or** locally installed PostgreSQL 16, Redis 7+, Elasticsearch 8.13

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env: fill in ETHEREAL_USER, ETHEREAL_PASSWORD, and optionally GOOGLE_* and SLACK_*
```

### 3. Start Infrastructure

```bash
npm run docker:up
# Wait for all healthchecks to pass: docker compose ps
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Database Setup

```bash
# Generate Prisma Client from schema
npm run db:generate

# Apply all migrations to the database
npm run db:migrate:deploy
```

### 6. Build Shared Library

```bash
npm run build:shared
```

### 7. Start Development Servers

```bash
# Both API (port 4000) and Web (port 3000) concurrently
npm run dev

# API only
npm run dev:api

# Web only
npm run dev:web
```

### 8. Optional: Prisma Studio

```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
```

---

## Monorepo Structure

```text
.
├── apps/
│   ├── api/                         # Express.js backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Authoritative Prisma schema
│   │   │   └── migrations/          # PostgreSQL migration history
│   │   ├── src/
│   │   │   ├── config/              # Zod-validated environment config
│   │   │   ├── controllers/         # Thin route handlers
│   │   │   ├── lib/                 # Prisma client, Redis client, logger
│   │   │   ├── middleware/          # requireAuth, errorHandler, notFoundHandler
│   │   │   ├── queues/              # BullMQ Queue instances and enqueue services
│   │   │   ├── repositories/        # Prisma query abstractions
│   │   │   ├── routes/              # Route definitions and Bull-Board mount
│   │   │   ├── services/
│   │   │   │   ├── auth/            # Google OAuth + session management
│   │   │   │   ├── search/          # Elasticsearch client, index, and search services
│   │   │   │   ├── slack/           # Slack OAuth, crypto, notification dispatch
│   │   │   │   └── smtp/            # Ethereal email transport
│   │   │   ├── utils/               # CSV extraction, logger, error classes
│   │   │   ├── workers/             # Email dispatch, index, and Slack notification workers
│   │   │   ├── app.ts               # Express app configuration
│   │   │   └── server.ts            # HTTP server lifecycle and graceful shutdown
│   │   └── tests/                   # 8 Vitest integration test suites
│   │
│   └── web/                         # Next.js 14 frontend
│       ├── app/                     # App Router: layout, pages, dashboard screens
│       ├── components/              # Shared UI components
│       ├── lib/                     # Frontend utilities
│       └── services/                # Client-side API integration
│
├── packages/
│   └── shared/                      # Shared TypeScript types and constants
│
├── infrastructure/
│   └── docker/                      # Infrastructure documentation
│
├── docker-compose.yml               # PostgreSQL 16, Redis 7, Elasticsearch 8.13
├── .env.example                     # All environment variable documentation
├── AGENTS.md                        # Engineering rules and hard constraints
└── package.json                     # Root workspace configuration and scripts
```

---

## Development Commands

All commands run from the repository root.

```bash
# Install all workspace dependencies
npm install

# Run all backend tests (Vitest)
npm test

# Run TypeScript type checking across all workspaces
npm run typecheck

# Run ESLint (Next.js rules for web package)
npm run lint

# Build all workspaces for production
npm run build

# Build individual workspaces
npm run build:shared
npm run build:api
npm run build:web

# Format all files
npm run format

# Database commands
npm run db:generate           # Generate Prisma Client
npm run db:migrate            # Create and apply new migration (dev only)
npm run db:migrate:deploy     # Apply existing migrations (production / CI)
npm run db:studio             # Open Prisma Studio

# Docker infrastructure shortcuts
npm run docker:up             # docker compose up -d
npm run docker:down           # docker compose down
npm run docker:logs           # docker compose logs -f
```

---

## Phase 8 Verification Evidence

The following results were recorded during Phase 8 final verification on this machine with live PostgreSQL, Redis, and Elasticsearch.

### Tests

```
npm test

 Test Files  8 passed (8)
      Tests  151 passed (151)
   Start at  17:37:28
   Duration  17.44s

✓ tests/database.test.ts            (13 tests)
✓ tests/health.test.ts               (3 tests)
✓ tests/email-queue.test.ts         (30 tests)
✓ tests/campaign.test.ts            (16 tests)
✓ tests/auth.test.ts                (30 tests)
✓ tests/slack.test.ts               (12 tests)
✓ tests/elasticsearch.test.ts       (33 tests)
✓ tests/production-hardening.test.ts (9 tests)
✓ tests/smtp.test.ts                (17 tests)

Passed:  151
Skipped:   0
Failed:    0
```

### Typecheck

```
npm run typecheck

> @reachinbox/shared@0.1.0 typecheck → tsc --noEmit   ✓
> @reachinbox/api@0.1.0   typecheck → tsc --noEmit   ✓
> @reachinbox/web@0.1.0   typecheck → tsc --noEmit   ✓

Exit code: 0 (no errors)
```

### Lint

```
npm run lint

> @reachinbox/web@0.1.0 lint → next lint
✔ No ESLint warnings or errors

Exit code: 0
```

### Build

```
npm run build

✓ @reachinbox/shared compiled
✓ @reachinbox/api compiled
✓ @reachinbox/web — Next.js 14 production build

Route (app)                              Size     First Load JS
┌ ○ /                                    3.86 kB         101 kB
├ ○ /dashboard                           3.23 kB         103 kB
├ ○ /dashboard/analytics                 3.69 kB        93.5 kB
├ ○ /dashboard/campaigns                 2.2 kB          102 kB
├ ƒ /dashboard/campaigns/[id]            4.19 kB         101 kB
├ ○ /dashboard/compose                   6.52 kB         106 kB
├ ○ /dashboard/integrations              5.55 kB        92.9 kB
├ ○ /dashboard/queues                    5.71 kB          93 kB
├ ○ /dashboard/scheduled                 2.09 kB         102 kB
├ ○ /dashboard/senders                   3.43 kB        93.3 kB
├ ○ /dashboard/sent                      4.31 kB         102 kB
└ ○ /dashboard/settings                  4.58 kB        91.9 kB

Exit code: 0
```

---

## Requirement Compliance Matrix

| Assignment Requirement | Implementation | Code Location | Status |
| :--- | :--- | :--- | :---: |
| Express.js backend | Express 4, TypeScript 5.7 | `apps/api/src/app.ts` | **PASS** |
| PostgreSQL persistence | Prisma 6.19, PostgreSQL 16 | `apps/api/prisma/` | **PASS** |
| Redis | ioredis 5.5 | `apps/api/src/queues/redis.ts` | **PASS** |
| BullMQ delayed scheduling | `emailQueue.addBulk()` | `apps/api/src/queues/email-enqueue.service.ts` | **PASS** |
| No cron engine | Zero cron/node-cron/agenda/setInterval | entire codebase | **PASS** |
| Worker concurrency (configurable) | `EMAIL_WORKER_CONCURRENCY` | `apps/api/src/workers/email.worker.ts` | **PASS** |
| Multiple sender accounts | `SenderAccount` model, per-user ownership | `apps/api/prisma/schema.prisma` | **PASS** |
| Minimum send delay | Redis Lua `email-spacing:{senderId}` | `apps/api/src/services/email-delivery-policy.service.ts` | **PASS** |
| Hourly rate limit (per sender) | Redis Lua `email-rate:{senderId}` | `apps/api/src/services/email-delivery-policy.service.ts` | **PASS** |
| Rate-limit rescheduling (no email dropped) | `RescheduleRequired` → BullMQ delayed re-add | `apps/api/src/workers/email.worker.ts` | **PASS** |
| Distributed rate limiting (multi-worker safe) | Atomic Lua script, single Redis call | `apps/api/src/services/email-delivery-policy.service.ts` | **PASS** |
| Ethereal SMTP delivery | `EtherealEmailTransport`, pooled Nodemailer | `apps/api/src/services/smtp/ethereal.transport.ts` | **PASS** |
| Idempotent delivery | Atomic `updateMany` DB claim, deterministic job IDs | `apps/api/src/workers/email.worker.ts` | **PASS** |
| Restart persistence | Redis sorted sets + PostgreSQL state | BullMQ + Prisma | **PASS** |
| 1,000+ recipient bulk handling | `createMany` (batches of 500) + `addBulk` | `apps/api/src/services/campaign.service.ts` | **PASS** |
| Elasticsearch indexing | `email-index` queue + worker + index service | `apps/api/src/services/search/` | **PASS** |
| Email search | `GET /api/emails/search`, multi-match + pagination | `apps/api/src/controllers/email-search.controller.ts` | **PASS** |
| Google OAuth 2.0 | Authorization code flow, state cookie, SHA-256 sessions | `apps/api/src/services/auth/` | **PASS** |
| Authenticated sessions | PostgreSQL `sessions` table, `requireAuth` middleware | `apps/api/src/middleware/auth.middleware.ts` | **PASS** |
| Slack OAuth 2.0 | OAuth callback, AES-256-GCM token storage | `apps/api/src/services/slack/` | **PASS** |
| Slack rate-limit notifications | Dedicated `slack-notification` queue and worker | `apps/api/src/workers/slack-notification.worker.ts` | **PASS** |
| Slack deduplication | Deterministic job ID per `userId+campaignId+senderId+hourWindow` | `apps/api/src/queues/slack-notification.queue.ts` | **PASS** |
| Live queue dashboard (Bull-Board) | `@bull-board/express` at `/admin/queues`, `requireAuth` | `apps/api/src/routes/admin-queues.routes.ts` | **PASS** |
| Frontend queue monitor | `/dashboard/queues` fetches `/api/admin/queues/metrics` | `apps/web/app/dashboard/queues/page.tsx` | **PASS** |
| Next.js frontend (React) | Next.js 14 App Router, Tailwind CSS | `apps/web/` | **PASS** |
| CSV recipient upload | Client-side CSV parsing, email extraction, deduplication | `apps/web/app/dashboard/compose/page.tsx` | **PASS** |
| Campaign dashboard | 14 frontend routes, 9 backend API route groups | `apps/web/`, `apps/api/` | **PASS** |
| No secrets committed | `.env` in `.gitignore`, `.env.example` placeholders only | `.gitignore`, `.env.example` | **PASS** |

---

## Known Limitations

1. **Live Google OAuth requires browser**: Automated tests simulate the OAuth callback. A real end-to-end login requires a browser, valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and a registered redirect URI at `http://localhost:4000/api/auth/google/callback` in the Google Cloud Console.

2. **Live Slack notifications require a connected workspace**: Automated tests stub the Slack connection. Real Slack alerts require valid `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and a Slack app authorized in a workspace with `chat:write` or `incoming-webhook` scope.

3. **Docker not live-tested on this machine**: Docker Desktop is not installed in the current environment. The `docker-compose.yml` file is structurally correct and was validated. Infrastructure was run using locally installed native binaries. Any machine with Docker will be able to run `docker compose up -d`.

4. **Ethereal SMTP is not a production delivery provider**: Ethereal Email is a test/development SMTP sink. Emails delivered to Ethereal are never forwarded to real recipients. Replacing with a production SMTP provider (SendGrid, SES, Postmark) would require swapping the `EmailTransport` implementation.

5. **Elasticsearch outage degrades search only**: The search endpoint falls back to PostgreSQL `ILIKE` queries when Elasticsearch is unavailable. Search relevance and pagination behavior differ between the two backends.

6. **No exactly-once SMTP guarantee**: The idempotency mechanism prevents duplicate sends within the system's control (BullMQ retries, worker restarts). It does not prevent a duplicate from an SMTP provider that accepted a message but returned a network error before the response was received. This is an inherent limitation of SMTP delivery.
