# ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed email scheduling and queue management system built for the ReachInbox technical assessment. Engineered with strict adherence to high-concurrency distributed systems principles: persistent BullMQ delayed job queues, atomic Redis rate limiting and inter-email delay throttling, Ethereal SMTP delivery, asynchronous Elasticsearch indexing, multi-sender management, real Slack OAuth alerting, Google OAuth 2.0 authentication, and a complete Next.js 14 dashboard aligned with the original Figma specification.

---

## 1. System Architecture

```text
                                 [ User / Browser ]
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 [ Google OAuth ]             [ Next.js 14 Frontend ]
                 (Auth Flow / PKCE)          (Tailwind CSS / Figma UI)
                         │                               │
                         └───────────────┬───────────────┘
                                         │ HTTP (JSON / Cookies)
                                         ▼
                            [ Express.js REST API ]
                             (Helmet / CORS / Zod)
                                         │
                   ┌─────────────────────┼─────────────────────┐
                   ▼                     ▼                     ▼
          [ PostgreSQL 16 ]        [ Redis 7 / 8 ]      [ Bull-Board Admin ]
          (Prisma Schema /        (Atomic Lua /         (/admin/queues +
           Authoritative State)   Token Bucket)         /dashboard/queues)
                   │                     │
                   │                     ▼
                   │             [ BullMQ Delayed Queues ]
                   │             ├── email-dispatch (concurrency: 10)
                   │             ├── email-index (concurrency: 5)
                   │             └── slack-notification (concurrency: 5)
                   │                     │
                   └──────────────┬──────┴─────────────────────┐
                                  │                            │
                                  ▼                            ▼
                      [ Email Dispatch Worker ]       [ Slack Worker ]
                      ├── Idempotency Check           (OAuth Token /
                      ├── Atomic DB Lock              Rate-Limit Alerts)
                      ├── Inter-Email Delay                    │
                      ├── Hourly Rate Limiter                  ▼
                      └── Reschedule on limit           [ Slack API ]
                                  │
                                  ▼
                        [ Ethereal SMTP Server ]
                                  │
                         (Delivery Success)
                                  │
                                  ▼
                       [ Email Index Worker ]
                                  │
                                  ▼
                     [ Elasticsearch 8.13 Cluster ]
                     (Full-Text Multi-Match Search)
```

### Core Design Principles
- **No Cron Engines**: Absolutely no `cron`, `node-cron`, `agenda`, `node-schedule`, or `setInterval` schedulers. Timing and delays are solely governed by BullMQ native delayed jobs and Redis sorted sets (`bullmqJobId`).
- **PostgreSQL as Authoritative Source of Truth**: All campaigns, email states (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`), senders, and user identities are durably persisted in PostgreSQL. Elasticsearch functions strictly as a search projection.
- **Strict Idempotency**: Email dispatches require atomic state transitions (`SCHEDULED` ➔ `PROCESSING`). Duplicate jobs or worker restarts immediately early-exit without sending duplicate emails.
- **Distributed Concurrency**: Distributed workers coordinate via atomic Redis Lua scripts (`reserveDeliverySlot`) to enforce sliding hour windows and inter-email delays across multiple processes.

---

## 2. Assignment Requirements Compliance Matrix

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Backend Framework** | Node.js + Express.js in strict TypeScript with centralized error handling | **PASS** |
| **Database Persistence** | PostgreSQL 16 managed via Prisma ORM with relational foreign keys and migrations | **PASS** |
| **Queue Scheduling** | BullMQ + Redis using delayed jobs; survivor across restarts without cron | **PASS** |
| **Worker Concurrency** | Configurable worker concurrency (`EMAIL_WORKER_CONCURRENCY=10`) | **PASS** |
| **Idempotency** | Deterministic job IDs, unique constraints, atomic `PROCESSING` DB claim lock | **PASS** |
| **Inter-Email Delay** | Configurable spacing (`MIN_EMAIL_DELAY_MS`) via atomic Redis slot reservation | **PASS** |
| **Hourly Rate Limiter** | Atomic sliding window token bucket per sender and global; reschedules to next hour window | **PASS** |
| **SMTP Delivery** | Ethereal Email SMTP with pooled Nodemailer transport; message ID & preview URL captured | **PASS** |
| **Elasticsearch** | Asynchronous indexing queue (`email-index`); resilient against Elasticsearch downtime | **PASS** |
| **Full-Text Search** | Multi-field search across recipient, sender, subject, and body with pagination | **PASS** |
| **Google OAuth** | Real Google OAuth 2.0 PKCE/state verification, user linking, session cookie lifecycle | **PASS** |
| **Slack Integration** | Real Slack OAuth 2.0 connection, encrypted token storage, rate-limit alert worker | **PASS** |
| **Slack Deduplication** | Redis key-based deduplication preventing alert storms under high email volume | **PASS** |
| **1,000+ Email Load** | Bulk database `createMany` and BullMQ `addBulk` handling 1,000 recipients in < 500ms | **PASS** |
| **Live Queue Dashboard** | `@bull-board/express` mounted at `/admin/queues` + Next.js monitor at `/dashboard/queues` | **PASS** |
| **Dashboard Security** | Queue monitor and administrative routes protected by session authentication | **PASS** |
| **Frontend UI** | Next.js 14 App Router (14 screens) faithfully reproducing the ReachInbox Figma design | **PASS** |
| **CSV Upload** | Robust email parser detecting valid email formats, stripping headers, and reporting counts | **PASS** |

---

## 3. Technology Stack

- **Monorepo**: npm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **Backend API**: Express.js 4, TypeScript 5.7, Zod validation, Helmet, CORS, Cookie-Parser
- **Database & ORM**: PostgreSQL 16, Prisma ORM 6.19
- **Queue & In-Memory Store**: BullMQ 6.3, ioredis 5.5, Redis 7+
- **Search Engine**: Elasticsearch 8.13 Client (`@elastic/elasticsearch`)
- **Email Delivery**: Nodemailer 10 + Ethereal Email SMTP
- **Queue Observability**: `@bull-board/express` & `@bull-board/api`
- **Frontend Web**: Next.js 14.2 (App Router), React 18, Tailwind CSS, Lucide Icons
- **Testing**: Vitest 3.0, Supertest 7.0

---

## 4. Key Subsystems & Implementation Details

### A. BullMQ Delayed Scheduling & Restart Persistence
- Email campaigns compute absolute dispatch timestamps: `scheduledAt = campaign.startTime + (index * campaign.delaySeconds * 1000)`.
- BullMQ assigns `delay = Math.max(0, scheduledAt.getTime() - Date.now())` using a deterministic job ID: `email-dispatch:${emailMessageId}`.
- If the API, worker, or Redis server restarts, delayed jobs remain in Redis sorted sets. Upon startup, BullMQ recovers all timers without re-enqueueing or skipping.

### B. Distributed Rate Limiting & Inter-Email Delay
- Rate limiting and throttling are evaluated atomically using Redis Lua scripts (`reserveDeliverySlot` in `apps/api/src/services/email-delivery-policy.service.ts`):
  1. Checks global hourly limit (`email-rate-limit:global:{hourWindow}`).
  2. Checks sender hourly limit (`email-rate-limit:sender:{senderId}:{hourWindow}`).
  3. Checks minimum delay spacing (`email-delay:sender:{senderId}`).
- If the hourly limit is exceeded, the job is not dropped or failed. The worker atomically calculates the milliseconds until the start of the next hour window (`windowEnd - now + 1000`) and reschedules the job in BullMQ.

### C. Idempotent Email Delivery
- Before sending via SMTP, the worker executes a single atomic PostgreSQL query:
  `UPDATE "EmailMessage" SET status = 'PROCESSING' WHERE id = :id AND status = 'SCHEDULED'`.
- If another worker or a retried job already acquired the lock or the email is already in `SENT` status, the worker exits immediately.
- Upon successful dispatch, the record is transitioned to `SENT`, storing the SMTP `messageId`, `previewUrl`, and `sentAt` timestamp.

### D. Asynchronous Elasticsearch Search Projection
- Successful email dispatches trigger an asynchronous job on `email-index`.
- The `email-index.worker.ts` indexes the document into Elasticsearch (`emails` index).
- **Fault Tolerance**: If Elasticsearch is unreachable or fails, the email remains safely in `SENT` status in PostgreSQL. The index job retries independently with exponential backoff.
- Search queries first query Elasticsearch using `multi_match` across `subject`, `body`, `recipient`, and `senderEmail`. If Elasticsearch is offline, the API falls back to PostgreSQL `ILIKE` queries.

### E. Real Google OAuth 2.0 & Session Management
- Implements standard OAuth 2.0 authorization code flow with cryptographically random `state` cookies.
- Upon callback, the API exchanges the code for Google tokens, fetches user information, and links or creates a PostgreSQL `User` record.
- Issues a secure `reachinbox_sid` cookie mapped to a persistent `Session` record in PostgreSQL.

### F. Real Slack OAuth & Deduplicated Alerting
- Authorizes Slack workspaces via OAuth 2.0 (`chat:write`, `incoming-webhook`), storing encrypted access tokens in `SlackConnection`.
- When an email worker detects an hourly rate limit, it emits a notification job to `slack-notification`.
- Alerts are deduplicated using a Redis key (`slack-ratelimit-alert:{senderId}:{hourWindow}`) with a 1-hour TTL, ensuring that a 1,000-email campaign hitting a rate limit generates only 1 Slack notification instead of 1,000.

### G. Live Queue Dashboard & Monitoring
- **Bull-Board UI**: Mounted at `/admin/queues` using `@bull-board/express` with `BullMQAdapter` for `email-dispatch`, `email-index`, and `slack-notification`.
- **Frontend Monitor**: A dedicated dashboard screen at `/dashboard/queues` fetches real-time snapshots from `GET /api/admin/queues/metrics` displaying waiting, active, delayed, completed, and failed counts along with worker concurrency.
- **Authentication**: Both endpoints are protected by `requireAuth` middleware requiring a valid session.

---

## 5. Local Setup & Infrastructure

### Prerequisites
- Node.js 20+ and npm 9+
- Docker & Docker Compose (or local PostgreSQL 16, Redis 7+, Elasticsearch 8.13)

### Step 1: Clone & Configure Environment
```bash
cp .env.example .env
```

Ensure `.env` contains your connection strings:
```env
PORT=3000
API_PORT=4000
DATABASE_URL=postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox_db?schema=public
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
WORKER_CONCURRENCY=5
EMAIL_WORKER_CONCURRENCY=10
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
```

### Step 2: Start Containerized Infrastructure
Start PostgreSQL 16, Redis 7 (AOF enabled), and Elasticsearch 8.13:
```bash
npm run docker:up
# or: docker compose up -d
```

Verify services are healthy:
```bash
docker compose ps
```

### Step 3: Install Dependencies & Run Database Migrations
```bash
# Install dependencies across all workspaces
npm install

# Generate Prisma Client & apply database migrations
npm run db:generate
npm run db:migrate:deploy
```

### Step 4: Build Shared Library
```bash
npm run build:shared
```

### Step 5: Start Development Servers
Run both API (`http://localhost:4000`) and Next.js Web (`http://localhost:3000`) concurrently:
```bash
npm run dev
```

Or run individual services:
```bash
npm run dev:api  # Express API & BullMQ workers
npm run dev:web  # Next.js 14 frontend
```

---

## 6. Monorepo Structure

```text
.
├── apps/
│   ├── api/
│   │   ├── prisma/                # Prisma schema & migrations
│   │   ├── src/
│   │   │   ├── config/            # Validated Zod environment config
│   │   │   ├── controllers/       # Auth, Campaign, Email, Senders, Slack
│   │   │   ├── middleware/        # Authentication, Error handling, Helmet
│   │   │   ├── queues/            # BullMQ queue instances (dispatch, index, slack)
│   │   │   ├── routes/            # REST route definitions & Bull-Board mount
│   │   │   ├── services/          # Business logic, Lua rate-limiting, OAuth
│   │   │   ├── utils/             # Sanitized logging, CSV extraction, Encryption
│   │   │   └── workers/           # Email dispatch, Elasticsearch index, Slack alert
│   │   └── tests/                 # 8 comprehensive Vitest integration test suites
│   │
│   └── web/
│       ├── app/                   # Next.js 14 App Router
│       │   ├── dashboard/         # Compose, Scheduled, Sent, Senders, Analytics, Queues
│       │   ├── login/             # Google OAuth login screen
│       │   └── layout.tsx         # Root layout with Tailwind CSS
│       ├── components/            # Reusable UI cards, tables, modal dialogs
│       └── services/              # Client-side API integration services
│
├── packages/
│   └── shared/                    # Shared TypeScript interfaces, types, & constants
│
├── infrastructure/
│   └── docker/                    # Docker container documentation
├── docker-compose.yml             # PostgreSQL 16, Redis 7, Elasticsearch 8.13
└── AGENTS.md                      # Engineering rules and hard constraints
```

---

## 7. Verification & Quality Commands

The complete repository is verified with automated tests covering all assignment requirements:

```bash
# Run all 151 unit and integration tests
npm test

# Run strict TypeScript typechecking across all workspaces
npm run typecheck

# Run Next.js and ESLint checks
npm run lint

# Build production bundles for shared, api, and web packages
npm run build
```

### Verified Test Results (Phase 8 Baseline)
```text
 Test Files  8 passed (8)
      Tests  151 passed (151)
   Duration  17.59s

✓ tests/smtp.test.ts (17 tests)
✓ tests/production-hardening.test.ts (9 tests)
✓ tests/auth.test.ts (30 tests)
✓ tests/elasticsearch.test.ts (33 tests)
✓ tests/email-queue.test.ts (30 tests)
✓ tests/campaign.test.ts (16 tests)
✓ tests/slack.test.ts (12 tests)
✓ tests/database.test.ts (4 tests)
```

---

## 8. API Reference Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/health` | Service health status | No |
| `GET` | `/api/auth/google` | Initiates Google OAuth 2.0 flow | No |
| `GET` | `/api/auth/google/callback` | Handles Google OAuth callback | No |
| `GET` | `/api/auth/me` | Returns authenticated user profile | **Yes** |
| `POST` | `/api/auth/logout` | Terminates session and invalidates cookie | **Yes** |
| `POST` | `/api/campaigns` | Creates and schedules campaign in bulk | **Yes** |
| `GET` | `/api/campaigns` | Lists user's campaigns with pagination | **Yes** |
| `GET` | `/api/campaigns/:id` | Returns campaign details and dispatch progress | **Yes** |
| `GET` | `/api/campaigns/:id/analytics`| Campaign delivery breakdown & metrics | **Yes** |
| `GET` | `/api/emails/scheduled` | Lists scheduled emails with delivery times | **Yes** |
| `GET` | `/api/emails/sent` | Lists sent emails with Ethereal preview URLs | **Yes** |
| `GET` | `/api/emails/search` | Full-text Elasticsearch search across emails | **Yes** |
| `POST` | `/api/senders` | Creates a new SMTP sender account | **Yes** |
| `GET` | `/api/senders` | Lists configured sender accounts | **Yes** |
| `GET` | `/api/slack/connect` | Initiates Slack OAuth connection | **Yes** |
| `GET` | `/api/slack/callback` | Handles Slack OAuth callback | No |
| `GET` | `/api/slack/status` | Returns Slack connection state | **Yes** |
| `POST` | `/api/slack/disconnect` | Disconnects Slack integration | **Yes** |
| `GET` | `/admin/queues` | Live Bull-Board queue administration UI | **Yes** |
| `GET` | `/api/admin/queues/metrics` | Real-time queue metrics JSON snapshot | **Yes** |

---

## 9. Security & Production Controls

1. **No Plaintext Credentials**: SMTP passwords and Slack OAuth tokens are encrypted at rest using AES-256-GCM.
2. **Sanitized Structured Logging**: All log outputs (`logger.ts`) redact session cookies, OAuth authorization codes, client secrets, and passwords.
3. **CORS & Helmet**: Helmet headers and strict CORS origin validation are enforced on all API endpoints.
4. **Input Validation**: All incoming request bodies and query parameters are strictly validated with Zod schemas.
5. **Session Cookies**: Session cookies use `HttpOnly`, `SameSite=Lax`, and conditional `Secure` flags.
6. **Graceful Shutdown**: Handles `SIGTERM` and `SIGINT` signals to gracefully close the HTTP server, BullMQ workers, Redis connections, and database connection pools.
