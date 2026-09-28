# ReachInbox Assignment — Antigravity Engineering Rules

## 1. Project Context

This repository is a full-stack email scheduling system built for the ReachInbox hiring assignment.

The goal is to create an original, production-oriented implementation of:

- Email scheduling
- Persistent BullMQ + Redis jobs
- PostgreSQL/MySQL persistence
- Ethereal SMTP email sending
- Worker concurrency
- Inter-email throttling
- Hourly rate limiting
- Idempotent email delivery
- Elasticsearch indexing/search
- Slack OAuth notifications
- Google OAuth authentication
- React/Next.js frontend
- Tailwind CSS
- BullMQ live dashboard
- Restart-safe job processing

The implementation must be original.

Do NOT copy or reproduce code from existing GitHub repositories.

---

# 2. Core Development Principle

## Work phase-by-phase.

Only implement the functionality explicitly requested in the current phase.

DO NOT:

- Build the entire application at once.
- Implement future phases prematurely.
- Rewrite working functionality unnecessarily.
- Refactor unrelated files.
- Replace the chosen architecture without a clear reason.
- Introduce unnecessary dependencies.
- Generate placeholder implementations for required production functionality.
- Mock functionality that the assignment explicitly requires to be real.

Before modifying the repository:

1. Inspect the existing project structure.
2. Inspect relevant existing files.
3. Understand the current architecture.
4. Reuse existing utilities/components where appropriate.
5. Make the smallest coherent change required for the current phase.

---

# 3. Assignment Hard Constraints

These requirements are NON-NEGOTIABLE.

## Backend

Required:

- TypeScript
- Express.js
- BullMQ
- Redis
- PostgreSQL OR MySQL
- Ethereal Email SMTP

## Frontend

Required:

- React.js OR Next.js
- TypeScript preferred
- Tailwind CSS or another modern CSS library

## Search

Required:

- Elasticsearch
- Scheduled/sent emails must be indexed
- Emails must be searchable

## Scheduling

Use:

- BullMQ delayed jobs

OR a custom Redis/DB scheduler.

DO NOT use cron.

---

# 4. ABSOLUTELY NO CRON

Never introduce:

- node-cron
- cron
- node-schedule
- agenda
- OS crontab
- setInterval-based scheduling
- setTimeout-based long-term scheduling

Do not simulate a scheduler using periodic polling.

Email scheduling must be handled by BullMQ delayed jobs or a properly persistent Redis/DB scheduling mechanism.

---

# 5. Persistence Requirements

The application must survive backend/worker restarts.

After restarting:

- Future scheduled emails must remain scheduled.
- Jobs must not disappear.
- Jobs must not start again from the beginning.
- Already successfully sent emails must not be sent again.
- Queue state must remain persistent in Redis.
- Email state must remain persistent in PostgreSQL/MySQL.

Never use in-memory arrays/maps as the source of truth for persistent application state.

Bad:

```ts
const scheduledEmails = [];
const sentEmails = [];
```

Good:

```text
PostgreSQL
    +
Redis/BullMQ
```

---

# 6. Idempotency

Email sending MUST be idempotent.

The same logical email must never be successfully sent more than once because of:

- Worker restart
- Server restart
- Job retry
- Network failure
- Worker crash
- Duplicate API requests
- Multiple workers

Every email/job must have a stable unique identifier.

Before sending an email:

1. Check persistent state.
2. Acquire the appropriate processing/send lock or use an atomic state transition.
3. Prevent another worker from processing the same logical email.
4. Send only when the job is legitimately pending.
5. Persist the result.

Use database constraints and/or Redis mechanisms where appropriate.

Do not rely solely on:

```ts
if (!alreadySent)
```

using an in-memory variable.

---

# 7. BullMQ Rules

BullMQ is the source of truth for scheduled job execution.

Use delayed jobs for scheduled emails.

Example conceptual flow:

```text
API
 ↓
PostgreSQL record
 ↓
BullMQ delayed job
 ↓
Redis
 ↓
Worker
 ↓
Rate-limit check
 ↓
Idempotency check
 ↓
Ethereal SMTP
 ↓
PostgreSQL update
 ↓
Elasticsearch indexing
```

Workers must support configurable concurrency.

Example environment variable:

```env
WORKER_CONCURRENCY=5
```

Never hardcode concurrency.

---

# 8. Worker Concurrency

Workers must be safe when multiple jobs execute simultaneously.

Assume:

```text
WORKER_CONCURRENCY > 1
```

and potentially multiple worker processes/instances.

Never assume only one worker exists.

Any shared state must be protected using:

- PostgreSQL transactions/constraints
- Redis atomic operations
- BullMQ mechanisms
- Proper locking where necessary

Do not use process-local variables to coordinate distributed workers.

---

# 9. Email Delay / Throttling

There must be a configurable minimum delay between email sends.

Example:

```env
MIN_EMAIL_DELAY_MS=2000
```

The value must NOT be hardcoded.

The implementation must document how the delay works.

Important:

A local JavaScript delay alone is not sufficient if it allows multiple workers to send emails simultaneously without respecting the global/sender throttling requirement.

Design the mechanism so that distributed workers behave safely.

---

# 10. Hourly Rate Limiting

Hourly limits must be configurable.

Example:

```env
MAX_EMAILS_PER_HOUR=200
```

OR per sender:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=50
```

The rate limiter must work across multiple workers/instances.

Do NOT implement:

```ts
let emailsSentThisHour = 0;
```

because this is process-local.

Use Redis and/or PostgreSQL.

A recommended conceptual Redis key:

```text
email-rate-limit:{senderId}:{hourWindow}
```

The exact implementation may differ.

The counter must be atomic.

---

# 11. Rate Limit Behavior

When the hourly limit is reached:

DO NOT:

- Drop the email.
- Permanently fail the email.
- Mark it as sent.
- Lose the job.

Instead:

```text
Current hour limit reached
        ↓
Determine next available hour
        ↓
Reschedule/delay job
        ↓
Preserve ordering as much as reasonably possible
        ↓
Process later
```

The behavior must be documented in README.

---

# 12. Slack Requirement

Slack integration must be REAL.

Do not implement fake Slack notifications.

Required behavior:

```text
User clicks Connect Slack
        ↓
Real OAuth authorization
        ↓
Backend receives callback
        ↓
Token/webhook stored securely
        ↓
Rate limit reached
        ↓
Backend sends real Slack message
```

If Slack is not connected:

```text
Rate limit reached
        ↓
No Slack notification
        ↓
No application crash
```

If the user connects Slack later:

```text
Future rate-limit events
        ↓
Slack notifications enabled
```

Do not require a redeploy.

---

# 13. Google OAuth

Google login must be real.

Do not create fake authentication mechanisms.

Required flow:

```text
Frontend
 ↓
Google OAuth
 ↓
Backend callback
 ↓
Validate identity
 ↓
Create/find user
 ↓
Authenticated session
 ↓
Dashboard
```

The dashboard must show:

- Name
- Email
- Avatar
- Logout

Protect authenticated APIs.

---

# 14. Database Rules

Use PostgreSQL or MySQL.

Prefer PostgreSQL unless an existing project decision says otherwise.

Database schema must represent persistent state clearly.

Likely entities include:

```text
users
email_campaigns
email_messages
email_jobs / job metadata
sender_accounts
slack_connections
```

Exact schema can be decided during the relevant phase.

Use:

- migrations
- foreign keys
- indexes
- unique constraints
- appropriate timestamps
- explicit status fields

Avoid storing everything in one giant table.

---

# 15. Email State Machine

Email state transitions must be explicit.

Possible states:

```text
scheduled
processing
sent
failed
cancelled
```

Additional states may be introduced if technically justified.

Do not randomly modify status values throughout the codebase.

Centralize state transitions where practical.

Example:

```text
scheduled
    ↓
processing
    ↓
sent
```

Failure:

```text
processing
    ↓
failed
```

Retry behavior must be carefully defined.

---

# 16. Elasticsearch

Scheduled and sent emails must be searchable.

When email state becomes relevant for search:

```text
PostgreSQL
    ↓
Elasticsearch index
```

The PostgreSQL database remains the persistent source of truth.

Elasticsearch is the search/indexing layer.

Do not make Elasticsearch the only storage location for email records.

Handle indexing failures explicitly.

Do not silently lose indexing failures.

---

# 17. BullMQ Dashboard

A live BullMQ dashboard is required.

Use a proper BullMQ-compatible dashboard solution.

It should expose useful queue information such as:

- Waiting
- Delayed
- Active
- Completed
- Failed

Protect the dashboard appropriately rather than exposing administrative functionality without consideration.

---

# 18. Frontend Architecture

Use reusable components.

Avoid putting the entire dashboard into one component.

Prefer something conceptually similar to:

```text
frontend/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── email/
│   └── auth/
├── pages/ or app/
├── hooks/
├── lib/
├── services/
├── types/
└── styles/
```

Exact structure depends on React vs Next.js.

Use TypeScript interfaces/types for:

- API responses
- API requests
- component props
- email objects
- user objects
- pagination
- errors

---

# 19. Frontend UX

Required:

- Loading states
- Empty states
- Error states
- Basic toast/error feedback
- Disabled states while submitting
- Form validation
- Responsive layout

Do not display raw backend errors directly to users when avoidable.

---

# 20. CSV Upload

The compose interface must support:

- CSV/text upload
- Email extraction
- Detection count
- Display of detected email count
- Validation before submission

Do not assume every line is a valid email.

Handle:

- duplicates
- empty lines
- invalid addresses
- whitespace
- headers where applicable

The backend must validate input again.

Never trust frontend validation alone.

---

# 21. API Design

Use clean REST-style APIs.

Example:

```text
POST   /api/auth/...
GET    /api/auth/me

POST   /api/emails/schedule
GET    /api/emails/scheduled
GET    /api/emails/sent
GET    /api/emails/search

POST   /api/slack/connect
GET    /api/slack/callback
POST   /api/slack/disconnect
```

Exact routes can be changed if there is a strong architectural reason.

Keep controllers thin.

Prefer:

```text
route
 ↓
controller
 ↓
service
 ↓
repository/data access
```

Do not put all business logic directly inside Express routes.

---

# 22. Error Handling

Use centralized backend error handling.

API errors should have predictable structure.

Example:

```json
{
  "error": {
    "code": "INVALID_EMAIL",
    "message": "One or more email addresses are invalid"
  }
}
```

Never expose secrets, tokens, passwords, or internal stack traces to clients.

---

# 23. Environment Variables

Secrets and configuration must come from environment variables.

Never commit:

- OAuth secrets
- database passwords
- Redis credentials
- Ethereal credentials
- Slack tokens
- Google client secrets
- encryption keys

Use:

```text
.env
.env.example
```

`.env` must be gitignored.

`.env.example` must document required variables without real secrets.

---

# 24. Security

Follow basic production security practices.

Consider:

- Helmet
- CORS configuration
- input validation
- authentication middleware
- authorization
- secure cookies/session handling
- OAuth state validation
- rate limiting for public APIs where appropriate
- secret management
- SQL injection protection
- XSS-safe rendering

Do not implement security features merely as decorative code.

They must actually work.

---

# 25. Docker

Redis and PostgreSQL should be easy to run locally.

Prefer:

```bash
docker compose up -d
```

for infrastructure.

Document all required commands.

---

# 26. Code Quality

Follow:

- DRY
- SOLID where appropriate
- clear naming
- small focused functions
- strong typing
- consistent formatting
- linting
- validation

Avoid:

- `any` unless genuinely necessary
- giant files
- giant functions
- duplicated business logic
- unexplained magic numbers
- dead code
- commented-out abandoned implementations
- unnecessary abstractions

Do not over-engineer simple functionality.

---

# 27. Dependencies

Before installing a dependency:

1. Check whether the functionality already exists in the project.
2. Check whether an existing dependency can solve it.
3. Only install a new package when justified.

Never install packages merely because they are popular.

Document important dependency choices.

---

# 28. Testing

Every major backend feature should have tests.

Especially test:

### Scheduling

- correct delayed job
- correct scheduled time
- persistence

### Restart

- future job survives restart

### Idempotency

- duplicate job does not send twice

### Rate limiting

- limit respected
- jobs rescheduled
- multiple workers share the limit

### Concurrency

- parallel jobs do not corrupt state

### Email

- successful send
- failure handling

### Authentication

- unauthenticated request rejected
- authenticated request accepted

Do not delete or weaken tests to make the build pass.

---

# 29. Verification Before Completing a Phase

Before declaring a phase complete, run the appropriate:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

or the project's equivalent commands.

If Docker is involved:

```bash
docker compose up -d
```

Verify services are actually healthy.

Do not claim something works if it has not been tested.

---

# 30. Do Not Hide Errors

If implementation fails:

DO NOT:

- suppress the error
- disable TypeScript checks
- remove the test
- add `@ts-ignore` without justification
- silently swallow exceptions
- fake successful responses

Instead:

1. Identify the actual problem.
2. Explain it.
3. Fix the root cause.
4. Re-run verification.

---

# 31. Git Rules

Keep commits meaningful.

Preferred examples:

```text
feat: add email scheduling API
feat: add BullMQ email worker
feat: implement Redis rate limiting
feat: add Google OAuth
feat: add Slack integration
feat: add scheduled email dashboard
fix: prevent duplicate email sends
test: add restart persistence tests
```

Do not commit:

```text
.env
node_modules/
dist/
build/
coverage/
secrets
```

---

# 32. Originality / Anti-Plagiarism

This is a hiring assignment.

Originality is mandatory.

DO NOT:

- clone an existing ReachInbox implementation
- copy a GitHub repository
- copy code from another candidate
- reproduce an online tutorial project
- intentionally imitate another repository's architecture/code line-for-line
- remove attribution from copied code

Use documentation and technical references for understanding.

Implement the actual solution independently.

When an external implementation materially influences a decision, document the source in the README where appropriate.

---

# 33. AI Assistance

AI assistance may be used as a development aid, but the resulting implementation must remain understandable and maintainable by the candidate.

The developer must understand:

- architecture
- database schema
- BullMQ behavior
- Redis usage
- rate limiting
- worker concurrency
- idempotency
- OAuth flows
- Elasticsearch indexing
- Slack integration
- frontend state management

Do not generate enormous amounts of code without reviewing it.

Prefer small, verifiable changes.

---

# 34. Figma

The frontend should closely follow the provided assignment Figma.

Before implementing UI:

1. Inspect the relevant design.
2. Identify layout hierarchy.
3. Identify typography.
4. Identify spacing.
5. Identify colors.
6. Identify components.
7. Identify states.

Do not blindly reproduce screenshots using hardcoded pixel dumps.

Build the UI using reusable components.

---

# 35. Current Phase Discipline

When given a phase prompt:

ONLY implement that phase.

At the end, report:

### Implemented

List exactly what changed.

### Files Changed

List important files.

### Verification

List commands executed and their results.

### Remaining

List anything intentionally left for a later phase.

### Next Phase

State what the next phase will require.

Do not automatically continue to the next phase.

---

# 36. Existing Code Protection

Before changing any existing file:

- Read it.
- Understand its purpose.
- Check its imports/usages.
- Preserve compatible behavior.

Never perform broad rewrites simply to match your preferred architecture.

If an architectural change is genuinely necessary:

1. Explain why.
2. Identify affected files.
3. Make the smallest safe migration.
4. Verify existing functionality afterward.

---

# 37. No Fake Implementations

Never use fake implementations for assignment requirements.

Examples of prohibited shortcuts:

```ts
// TODO: integrate Google later
const user = { name: 'Demo User' };
```

```ts
console.log('Slack notification sent');
```

```ts
const searchResults = emails.filter(...);
```

when Elasticsearch is required.

```ts
setTimeout(() => sendEmail(), delay);
```

for persistent scheduling.

```ts
const queue = [];
```

instead of BullMQ/Redis.

If a required external service cannot currently be configured, implement the integration correctly and clearly document the required environment variables/setup.

---

# 38. Performance Expectations

The system must be designed to handle:

```text
1000+ emails scheduled around the same time
```

Do not create one HTTP request per email unnecessarily.

Prefer batch scheduling where appropriate.

Do not load thousands of records into memory if pagination/streaming is more appropriate.

Use database indexes for frequent queries.

Use Redis/BullMQ appropriately.

---

# 39. Time and Date Handling

Always handle scheduled timestamps explicitly.

Prefer ISO 8601 timestamps.

Store timestamps consistently, preferably in UTC.

Convert to local time only at the presentation layer.

Avoid ambiguous date parsing.

Example:

```text
2026-09-28T14:30:00Z
```

---

# 40. Logging

Use structured, useful logs.

Logs should help diagnose:

- job ID
- email ID
- sender ID
- queue events
- worker events
- rate-limit events
- SMTP failures
- Elasticsearch failures

Never log:

- OAuth access tokens
- passwords
- API secrets
- complete sensitive credentials

---

# 41. Final Assignment Audit

Before submission, verify every requirement.

## Backend

- [ ] TypeScript
- [ ] Express
- [ ] PostgreSQL/MySQL
- [ ] Redis
- [ ] BullMQ
- [ ] Delayed jobs
- [ ] Ethereal SMTP
- [ ] Multiple senders
- [ ] Worker concurrency
- [ ] Minimum send delay
- [ ] Hourly rate limit
- [ ] Distributed rate limiting
- [ ] Rescheduling after limit
- [ ] Idempotency
- [ ] Restart persistence
- [ ] Elasticsearch
- [ ] Search
- [ ] BullMQ dashboard
- [ ] Slack OAuth
- [ ] Live Slack notification

## Frontend

- [ ] Google OAuth
- [ ] User information
- [ ] Logout
- [ ] Dashboard
- [ ] Scheduled emails
- [ ] Sent emails
- [ ] Compose email
- [ ] CSV upload
- [ ] Email detection count
- [ ] Start time
- [ ] Delay
- [ ] Hourly limit
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Figma-aligned UI

## Submission

- [ ] Private GitHub repository
- [ ] Required users granted access
- [ ] README
- [ ] Architecture documentation
- [ ] Environment setup
- [ ] Feature mapping
- [ ] Assumptions/trade-offs
- [ ] Demo video <= 5 minutes
- [ ] Restart demonstration
- [ ] Rate-limit demonstration
- [ ] No secrets committed
- [ ] No plagiarized code

---

# 42. Golden Rule

## DO NOT optimize for "more code."

Optimize for:

```text
Correctness
    ↓
Persistence
    ↓
Reliability
    ↓
Security
    ↓
Testability
    ↓
Maintainability
    ↓
UI quality
```

A smaller implementation that genuinely satisfies the requirements is better than a huge implementation containing fake or fragile functionality.

Every change must have a reason.

Every requirement must be testable.

Every major architectural decision must be explainable by the developer.
