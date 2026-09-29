# ReachInbox Production Deployment Guide

This guide documents the end-to-end production deployment process for the ReachInbox Email Scheduler monorepo across **Vercel** (Frontend), **Railway** (Backend API, Workers, PostgreSQL, Redis), and **Elasticsearch Cloud**.

---

## Architecture Overview

```text
┌─────────────────────────────────┐
│     Next.js 14 Frontend         │  Hosted on Vercel
│     (apps/web)                  │  Domain: https://reachinbox.vercel.app
└───────────────┬─────────────────┘
                │
                │ HTTPS + Session Cookie (credentials: 'include')
                ▼
┌─────────────────────────────────┐
│     Express.js API + Workers    │  Hosted on Railway
│     (apps/api)                  │  Domain: https://reachinbox-api.up.railway.app
└───────┬──────────────┬──────────┘
        │              │
        ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐
│  PostgreSQL  │ │    Redis     │ │   Elasticsearch Cloud   │
│  (Railway)   │ │  (Railway)   │ │   (Elastic Cloud)       │
└──────────────┘ └──────────────┘ └─────────────────────────┘
```

---

## 1. Prerequisites & Account Setup

1. **GitHub Repository**: Push repository to GitHub.
2. **Vercel Account**: Linked to your GitHub account.
3. **Railway Account**: Linked to your GitHub account.
4. **Elastic Cloud Account**: For hosted Elasticsearch 8.x.
5. **Google Cloud Console**: OAuth 2.0 Client Credentials configured.
6. **Slack API Portal**: Slack App with OAuth 2.0 Credentials configured.
7. **Ethereal Email**: SMTP credentials from [ethereal.email](https://ethereal.email).

---

## 2. Infrastructure Setup (Railway & Elastic Cloud)

### 2.1 Railway PostgreSQL
1. In Railway dashboard, create a new Project.
2. Click **+ New** → **Database** → **Add PostgreSQL**.
3. Railway automatically creates the database and exposes the `DATABASE_URL` variable.
4. Note the connection string: `postgresql://postgres:password@host:port/railway`.

### 2.2 Railway Redis
1. In the same Railway Project, click **+ New** → **Database** → **Add Redis**.
2. Railway provides the `REDIS_URL` connection variable (e.g. `redis://default:password@host:port`).
3. For BullMQ delayed jobs and rate-limit persistence, Redis requires persistent appendonly storage.

### 2.3 Elasticsearch Cloud
1. Create a deployment on [Elastic Cloud](https://cloud.elastic.co/) (Elasticsearch 8.13+).
2. Save your cluster credentials:
   - **Elasticsearch URL**: `https://<cluster-name>.es.<region>.aws.elastic-cloud.com:9243` (or port 9200)
   - **Username**: `elastic`
   - **Password**: `<generated-password>`
3. The ReachInbox API automatically initializes index mappings and settings on first boot.

---

## 3. Backend API & Worker Setup (Railway)

### 3.1 Create Railway Service
1. In your Railway project, click **+ New** → **GitHub Repo** → select your ReachInbox repository.
2. In the service settings:
   - **Service Name**: `reachinbox-api`
   - **Root Directory**: `/` (Monorepo root)
   - **Build Command**:
     ```bash
     npm install && npm run db:generate && npm run build:shared && npm run build:api
     ```
   - **Start Command**:
     ```bash
     npm run db:migrate:deploy && node apps/api/dist/server.js
     ```

### 3.2 Railway Production Port
- Railway dynamically assigns a listening port via the `PORT` environment variable.
- The ReachInbox API automatically detects and binds to `process.env.PORT` in production (with a graceful fallback to `API_PORT=4000` for local development).
- Set `API_HOST=0.0.0.0` to ensure Express binds to all network interfaces.

### 3.3 Railway Environment Variables Reference

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations and secure cookies |
| `API_PORT` | `4000` | Port Express server listens on |
| `API_HOST` | `0.0.0.0` | Network binding interface |
| `CORS_ORIGIN` | `https://reachinbox.vercel.app` | Vercel production frontend origin |
| `WEB_ORIGIN` | `https://reachinbox.vercel.app` | Vercel origin for OAuth redirects |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway managed PostgreSQL connection string |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Railway managed Redis connection string |
| `SESSION_SECRET` | *(64-char random hex)* | Secret used to HMAC session tokens |
| `SESSION_COOKIE_NAME` | `reachinbox_sid` | Session cookie identifier |
| `SESSION_MAX_AGE_MS` | `604800000` | 7-day session validity (in ms) |
| `WORKER_CONCURRENCY` | `5` | Concurrency for primary email worker |
| `EMAIL_WORKER_CONCURRENCY` | `10` | Simultaneous jobs in email worker |
| `MIN_EMAIL_DELAY_MS` | `2000` | Minimum spacing delay between sends per sender |
| `MAX_EMAILS_PER_HOUR` | `200` | Global hourly send limit |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` | Per-sender hourly send limit |
| `EMAIL_MAX_ATTEMPTS` | `5` | Max BullMQ retry attempts for email sends |
| `EMAIL_RETRY_DELAY_MS` | `5000` | Backoff retry interval for failed sends |
| `EMAIL_SCHEDULING_BATCH_SIZE` | `500` | Batch size for bulk campaign enqueueing |
| `ETHEREAL_HOST` | `smtp.ethereal.email` | Ethereal SMTP server |
| `ETHEREAL_PORT` | `587` | Ethereal SMTP port |
| `ETHEREAL_SECURE` | `false` | TLS false for port 587 STARTTLS |
| `ETHEREAL_USER` | `your_account@ethereal.email` | Ethereal test account username |
| `ETHEREAL_PASSWORD` | `your_ethereal_password` | Ethereal test account password |
| `ELASTICSEARCH_URL` | `https://<cluster-name>.es.<region>.aws.elastic-cloud.com:9243` | Elastic Cloud URL |
| `ELASTICSEARCH_INDEX` | `emails` | Elastic index name |
| `ELASTICSEARCH_USERNAME` | `elastic` | Elastic cluster username |
| `ELASTICSEARCH_PASSWORD` | `your_elastic_password` | Elastic cluster password |
| `ELASTICSEARCH_REQUEST_TIMEOUT_MS` | `10000` | Timeout for search and index operations |
| `INDEXING_WORKER_CONCURRENCY` | `5` | Indexing BullMQ worker concurrency |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Google Cloud OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://reachinbox-api.up.railway.app/api/auth/google/callback` | Google OAuth callback URL on Railway |
| `GOOGLE_CALLBACK_URL` | `https://reachinbox-api.up.railway.app/api/auth/google/callback` | Google OAuth callback URL fallback |
| `SLACK_CLIENT_ID` | `xxx.xxx` | Slack App Client ID |
| `SLACK_CLIENT_SECRET` | `xxx` | Slack App Client Secret |
| `SLACK_REDIRECT_URI` | `https://reachinbox-api.up.railway.app/api/slack/callback` | Slack OAuth callback URL on Railway |
| `SLACK_TOKEN_ENCRYPTION_KEY` | *(32-char hex string)* | AES-256 key for encrypted Slack bot tokens |

---

## 4. Frontend Setup (Vercel)

### 4.1 Import Repository to Vercel
1. In Vercel, click **Add New...** → **Project** → select your GitHub repository.
2. Configure Project Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
3. Configure Build and Output Settings:
   - **Build Command**: `cd ../.. && npm run build:shared && npm run build:web`
   - **Output Directory**: `.next`
   - **Install Command**: `cd ../.. && npm install`

### 4.2 Frontend Environment Variables
In Vercel **Settings** → **Environment Variables**, add:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://reachinbox-api.up.railway.app` | Base URL of deployed Railway API |

---

## 5. Worker Startup & Architecture

### 5.1 Unified Process (Current Default Architecture)
The repository uses a unified server architecture where starting `server.ts` activates:
1. Express HTTP server
2. BullMQ `emailWorker` (processes `email-dispatch` queue)
3. BullMQ `emailIndexWorker` (processes `email-index` queue)
4. BullMQ `slackNotificationWorker` (processes `slack-notification` queue)

Command:
```bash
node apps/api/dist/server.js
```

### 5.2 Separate Worker Process (Optional Distributed Setup)
If scaling API requests and background workers independently:
- **API Service (Railway)**: Runs `node apps/api/dist/server.js`
- **Worker Service (Railway Background Worker)**: Runs dedicated worker process:
  ```bash
  node apps/api/dist/workers/email.worker.js
  ```
Because BullMQ state and Redis locks are centralized in Redis, running multiple worker processes across instances is safe, concurrent, and idempotent.

---

## 6. OAuth Configuration & Callback URLs

### 6.1 Google Cloud OAuth 2.0
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Select your project and navigate to **APIs & Services** → **Credentials**.
3. Under **OAuth 2.0 Client IDs**, edit your Web application client.
4. **Authorized JavaScript origins**:
   - `https://reachinbox.vercel.app`
   - `https://reachinbox-api.up.railway.app`
5. **Authorized redirect URIs**:
   - `https://reachinbox-api.up.railway.app/api/auth/google/callback`

### 6.2 Slack App OAuth 2.0
1. Open [Slack API Apps](https://api.slack.com/apps).
2. Select your App → **OAuth & Permissions**.
3. Under **Redirect URLs**, add:
   - `https://reachinbox-api.up.railway.app/api/slack/callback`
4. Under **Scopes** → **Bot Token Scopes**, verify permissions:
   - `incoming-webhook`
   - `chat:write`
   - `commands`

---

## 7. Database Migrations & Prisma

The repository includes 5 production-ready Prisma migrations:
1. `20260928000000_init` (Core users, senders, campaigns, messages, jobs)
2. `20260928000001_add_google_auth_and_sessions` (Google ID, sessions)
3. `20260928000002_add_slack_connection_fields` (Encrypted Slack token storage)
4. `20260929000000_add_contacts_model` (Audience and contacts)
5. `20260929000001_add_reachinbox2_models` (Templates, suppressions, events, telemetry)

### Running Migrations in Production
Executed automatically on Railway startup via:
```bash
npm run db:migrate:deploy
# Equivalent to: npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

---

## 8. Production Verification Checklist

Once Railway and Vercel services are deployed, perform these verification steps:

### Step 1: Health Endpoints
- `GET https://reachinbox-api.up.railway.app/health` → Should return `{"status":"ok"}`
- `GET https://reachinbox-api.up.railway.app/health/ready` → Should verify database, Redis, and Elasticsearch connectivity.

### Step 2: Authentication Flow
1. Visit `https://reachinbox.vercel.app`.
2. Click **Sign in with Google**.
3. Confirm consent screen redirects back to `/dashboard` with avatar and name populated.
4. Verify cookie `reachinbox_sid` is stored and sent with credentials.

### Step 3: Campaign & Queue Execution
1. Navigate to **Compose**.
2. Upload CSV or enter recipient emails.
3. Schedule campaign for immediate delivery.
4. Access BullMQ live queue monitor at `/dashboard/queues` or `/admin/queues`.
5. Verify jobs transition from `delayed` → `active` → `completed`.
6. Inspect delivered emails via Ethereal preview links in `/dashboard/sent`.

### Step 4: Search Verification
1. Open search bar on `/dashboard/sent`.
2. Search for recipient email address or subject text.
3. Verify fast Elasticsearch query responses.

---

## 9. Troubleshooting & Common Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `PrismaClientInitializationError: Can't reach database` | `DATABASE_URL` misconfigured on Railway | Reference `${{Postgres.DATABASE_URL}}` in Railway variables |
| `ECONNREFUSED` connecting to Redis | `REDIS_URL` missing or incorrect | Reference `${{Redis.REDIS_URL}}` in Railway variables |
| `CORS error` when frontend calls API | `CORS_ORIGIN` does not match Vercel URL | Update `CORS_ORIGIN` on Railway to match exact Vercel URL (e.g. `https://reachinbox.vercel.app`) |
| Session cookie not saved on Vercel | Browser cross-site cookie restrictions | Ensure Next.js API rewrite or `sameSite: 'none'` with `secure: true` is configured |
| Slack notification not sent on rate limit | Slack worker not running or connection missing | Ensure `slackNotificationWorker` is active and user has authorized Slack |
