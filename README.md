# ReachInbox

A production-oriented email campaign scheduling and delivery platform built with **Next.js, Express, PostgreSQL, Prisma, Redis, BullMQ, Elasticsearch, and Ethereal SMTP**.

ReachInbox allows users to create email campaigns, import recipients through CSV, schedule delivery, configure sending limits and delays, manage multiple senders, track delivery, search emails, and monitor background queues.

---

## Features

* Google OAuth authentication
* Session-based authentication
* Campaign creation and management
* CSV recipient upload
* Scheduled email delivery
* Configurable delay between emails
* Hourly sending limits
* Multiple sender accounts
* BullMQ-based background processing
* Redis-backed scheduling and rate limiting
* Idempotent email processing
* Restart-safe scheduled jobs
* Ethereal SMTP email delivery
* Elasticsearch email indexing and search
* Slack OAuth integration
* Slack rate-limit notifications
* Live BullMQ queue monitoring
* Campaign analytics
* Scheduled and sent email views
* Sender management
* Settings and integrations
* Loading, empty, and error states

---

# Architecture

```text
                    ┌─────────────────────┐
                    │     Next.js Web     │
                    │      Frontend       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Express API      │
                    │     TypeScript      │
                    └──────┬──────┬───────┘
                           │      │
              ┌────────────┘      └───────────────┐
              ▼                                   ▼
     ┌─────────────────┐                  ┌─────────────────┐
     │ PostgreSQL      │                  │ Redis           │
     │ Prisma          │                  │ BullMQ          │
     └─────────────────┘                  └────────┬────────┘
                                                    │
                              ┌─────────────────────┼──────────────────┐
                              ▼                     ▼                  ▼
                     Email Dispatch          Email Indexing      Slack Notification
                         Worker                  Worker               Worker
                              │                     │                  │
                              ▼                     ▼                  ▼
                       Ethereal SMTP          Elasticsearch          Slack
```

PostgreSQL is the authoritative source for application and email state.

Redis/BullMQ handles asynchronous scheduling and background processing.

Elasticsearch acts as a search/indexing projection and does not replace PostgreSQL as the source of truth.

---

# Tech Stack

### Frontend

* Next.js 14
* React
* TypeScript
* App Router

### Backend

* Node.js
* Express
* TypeScript
* Zod

### Database

* PostgreSQL
* Prisma ORM

### Queue / Scheduling

* Redis
* BullMQ

### Email

* Nodemailer
* Ethereal SMTP

### Search

* Elasticsearch

### Authentication

* Google OAuth 2.0
* Database-backed sessions
* HttpOnly cookies

### Integrations

* Slack OAuth 2.0

---

# Project Structure

```text
.
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── queues/
│   │   │   ├── workers/
│   │   │   └── server.ts
│   │   └── tests/
│   │
│   └── web/
│       ├── app/
│       ├── components/
│       └── ...
│
├── packages/
│   └── shared/
│
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

---

# Core Workflow

## 1. Create a campaign

The user:

1. Selects a sender.
2. Uploads a CSV containing recipients.
3. Provides subject and body.
4. Selects a start time.
5. Configures the delay between emails.
6. Configures an hourly sending limit.
7. Schedules the campaign.

The backend creates the required persistent records and schedules BullMQ jobs in bulk.

---

## 2. Deterministic scheduling

For a campaign:

```text
scheduledAt = startAt + (recipientIndex × delay)
```

Example:

```text
Start: 10:00:00
Delay: 5 seconds

Email 1 → 10:00:00
Email 2 → 10:00:05
Email 3 → 10:00:10
Email 4 → 10:00:15
```

Scheduling is handled through BullMQ delayed jobs.

There is no long-running application scheduler.

---

# Rate Limiting

ReachInbox uses Redis-backed rate limiting.

The delivery policy controls:

* hourly limits
* minimum delay between emails
* sender-level limits
* global limits
* concurrent workers

When an hourly limit is reached, emails are **rescheduled** rather than discarded.

```text
Rate limit reached
        ↓
Delivery denied
        ↓
BullMQ job rescheduled
        ↓
Next available window
        ↓
Worker processes email
```

Redis operations are implemented atomically to support multiple workers safely.

---

# Idempotency

Email delivery uses persistent state and deterministic identifiers to prevent duplicate logical sends.

The worker claims an email before delivery:

```text
SCHEDULED
    ↓
PROCESSING
    ↓
SENT
```

If a job is retried or the worker restarts, the existing database state is checked before sending again.

This allows scheduled work to survive application/worker restarts without intentionally duplicating sends.

---

# Email Delivery

The email worker uses Nodemailer with Ethereal SMTP.

```text
BullMQ
   ↓
Email Worker
   ↓
Delivery policy
   ↓
Database claim
   ↓
Ethereal SMTP
   ↓
SENT
```

Successful messages retain the provider message information and Ethereal preview URL where available.

---

# Elasticsearch

Successful email delivery can be indexed asynchronously.

```text
Email SENT
    ↓
Email Index Queue
    ↓
Elasticsearch Worker
    ↓
Elasticsearch
```

Search supports email-related fields such as:

* sender
* recipient
* subject
* body
* status
* campaign
* date

PostgreSQL remains authoritative if Elasticsearch is temporarily unavailable.

---

# Slack Integration

Slack can be connected through OAuth.

Rate-limit events can generate Slack notifications through a dedicated BullMQ queue.

```text
Rate limit reached
        ↓
Notification deduplication
        ↓
Slack Queue
        ↓
Slack Worker
        ↓
Slack
```

Slack notification failures do not change the underlying email delivery state.

---

# Queue Monitoring

The project provides two queue-monitoring interfaces.

### Frontend queue monitor

```text
/dashboard/queues
```

### Bull-Board

```text
/admin/queues
```

The queue dashboard provides visibility into the background processing system.

The monitored queues include:

```text
email-dispatch
email-index
slack-notification
```

Queue administration is protected by application authentication.

---

# Frontend Routes

```text
/
├── dashboard
├── dashboard/compose
├── dashboard/scheduled
├── dashboard/sent
├── dashboard/campaigns
├── dashboard/campaigns/[id]
├── dashboard/analytics
├── dashboard/senders
├── dashboard/integrations
├── dashboard/queues
└── dashboard/settings
```

---

# Local Development

## Requirements

Install:

* Node.js
* npm
* PostgreSQL
* Redis
* Elasticsearch

Docker Compose is also provided for the infrastructure configuration.

---

# Environment Configuration

Copy the example configuration:

```bash
cp .env.example .env
```

Configure the required values for:

```text
PostgreSQL
Redis
Elasticsearch
Ethereal SMTP
Google OAuth
Slack OAuth
application/session configuration
```

Never commit real credentials.

---

# Start Infrastructure

If Docker is available:

```bash
docker compose up -d
```

Or:

```bash
npm run docker:up
```

Verify the required services are available before starting the application.

---

# Database Setup

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate:deploy
```

For development migration workflows, use the repository's Prisma migration scripts.

---

# Start the Application

Start both frontend and backend:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

---

# Local URLs

### Frontend

```text
http://localhost:3000
```

### Dashboard

```text
http://localhost:3000/dashboard
```

### API

```text
http://localhost:4000
```

### Health

```text
http://localhost:4000/health
```

### Frontend Queue Monitor

```text
http://localhost:3000/dashboard/queues
```

### Bull-Board

```text
http://localhost:4000/admin/queues
```

---

# Production Deployment

The application can be deployed as separate frontend and backend services.

Recommended structure:

```text
Next.js
   ↓
Vercel

Express + Workers
   ↓
Railway

PostgreSQL
   ↓
Managed PostgreSQL

Redis
   ↓
Managed Redis

Elasticsearch
   ↓
Elasticsearch Cloud
```

Production deployment requires configuring the appropriate environment variables and OAuth callback URLs for the deployed domains.

See:

```text
DEPLOYMENT.md
```

for the repository-specific deployment configuration.

---

# Testing

Run the complete test suite:

```bash
npm test
```

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Recommended final verification:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

---

# Production Verification

The project includes verification for areas including:

* database persistence
* campaign creation
* BullMQ scheduling
* SMTP delivery
* rate limiting
* multiple senders
* authentication
* Slack integration
* Elasticsearch
* restart persistence
* duplicate job protection
* large recipient campaigns
* graceful shutdown
* production deployment configuration

The exact test count should be taken from the latest repository test run rather than hard-coded in this document.

---

# Security

The application uses:

* authenticated API access
* HttpOnly session cookies
* OAuth state protection
* server-side ownership checks
* Zod request validation
* Helmet
* CORS configuration
* encrypted integration credentials
* Redis atomic operations
* idempotent email processing

Sensitive values must remain in environment variables.

Never commit:

```text
.env
OAuth secrets
SMTP passwords
Slack tokens
session secrets
database credentials
Redis credentials
private keys
```

---

# Scheduling Architecture

ReachInbox deliberately does **not** use cron-based email scheduling.

The scheduling flow is:

```text
Campaign
   ↓
Persistent EmailMessage records
   ↓
BullMQ delayed jobs
   ↓
Redis
   ↓
Email Worker
   ↓
SMTP
```

Redis/BullMQ remains responsible for delayed execution.

This means scheduled jobs are not dependent on a Node.js process remaining alive with an in-memory timer.

---

# Operational Guarantees

The implementation is designed around these principles:

### PostgreSQL is authoritative

Email state is persisted in PostgreSQL.

### BullMQ handles asynchronous work

Email delivery, indexing, and Slack notifications run through dedicated queues.

### Redis provides distributed coordination

Rate limiting and scheduling coordination use Redis.

### Elasticsearch is a projection

Search/indexing failures do not redefine successful email delivery.

### Workers are restart-safe

Persistent jobs can continue after worker/API restarts.

### Bulk operations are used

Campaign creation is designed around bulk database insertion and BullMQ bulk enqueueing rather than one HTTP request per recipient.

---

# External Service Limitations

Some integrations require external credentials or browser-based authorization.

### Google OAuth

A real production login requires configured Google Cloud OAuth credentials and the correct production callback URL.

### Slack

Real Slack notifications require a configured Slack application and authorized workspace.

### Ethereal

Ethereal is intended as a development/demo SMTP service rather than a production transactional email provider.

For real production email delivery, the SMTP configuration would need to be replaced with an appropriate production email provider.

---

# Development Principles

The project intentionally preserves:

```text
PostgreSQL
+
Prisma
+
Redis
+
BullMQ
+
Express
+
Next.js
+
Elasticsearch
+
SMTP
+
OAuth
```

No additional scheduler is required.

The email scheduling system is backend-driven and does not depend on frontend polling.

---

# License

MIT
