# ReachInbox Assignment â€” Antigravity Engineering Rules

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
 â†“
PostgreSQL record
 â†“
BullMQ delayed job
 â†“
Redis
 â†“
Worker
 â†“
Rate-limit check
 â†“
Idempotency check
 â†“
Ethereal SMTP
 â†“
PostgreSQL update
 â†“
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
        â†“
Determine next available hour
        â†“
Reschedule/delay job
        â†“
Preserve ordering as much as reasonably possible
        â†“
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
        â†“
Real OAuth authorization
        â†“
Backend receives callback
        â†“
Token/webhook stored securely
        â†“
Rate limit reached
        â†“
Backend sends real Slack message
```

If Slack is not connected:

```text
Rate limit reached
        â†“
No Slack notification
        â†“
No application crash
```

If the user connects Slack later:

```text
Future rate-limit events
        â†“
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
 â†“
Google OAuth
 â†“
Backend callback
 â†“
Validate identity
 â†“
Create/find user
 â†“
Authenticated session
 â†“
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
    â†“
processing
    â†“
sent
```

Failure:

```text
processing
    â†“
failed
```

Retry behavior must be carefully defined.

---

# 16. Elasticsearch

Scheduled and sent emails must be searchable.

When email state becomes relevant for search:

```text
PostgreSQL
    â†“
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
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ ui/
â”‚   â”œâ”€â”€ layout/
â”‚   â”œâ”€â”€ email/
â”‚   â””â”€â”€ auth/
â”œâ”€â”€ pages/ or app/
â”œâ”€â”€ hooks/
â”œâ”€â”€ lib/
â”œâ”€â”€ services/
â”œâ”€â”€ types/
â””â”€â”€ styles/
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
 â†“
controller
 â†“
service
 â†“
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
    â†“
Persistence
    â†“
Reliability
    â†“
Security
    â†“
Testability
    â†“
Maintainability
    â†“
UI quality
```

A smaller implementation that genuinely satisfies the requirements is better than a huge implementation containing fake or fragile functionality.

Every change must have a reason.

Every requirement must be testable.

Every major architectural decision must be explainable by the developer.

# 43. Antigravity Implementation Role

Antigravity is the primary coding agent for this repository.

When the user provides a phase-specific implementation prompt:

1. Inspect the current repository.
2. Read the relevant existing files.
3. Implement the requested functionality directly in the repository.
4. Create and modify files as required.
5. Install dependencies only when necessary.
6. Run the relevant tests/typechecks/build commands.
7. Fix implementation errors found during verification.
8. Do NOT stop after merely explaining what code should be written.
9. Do NOT return large code blocks instead of modifying the repository when repository access is available.

The user and ChatGPT may provide architecture, debugging, review, and implementation guidance.

Antigravity must follow the current phase and must not implement future phases unless explicitly instructed.

---

# 44. ChatGPT + Antigravity Workflow

This project may be developed collaboratively between ChatGPT and Antigravity.

### ChatGPT responsibilities

ChatGPT may:

- Design architecture.
- Break the assignment into phases.
- Generate implementation code.
- Review Antigravity's implementation.
- Analyze errors and stack traces.
- Suggest fixes.
- Explain technical decisions.
- Create configuration files.
- Review security and reliability.
- Audit assignment requirements.
- Prepare README/documentation.
- Prepare tests and test scenarios.
- Prepare the final demo script.

### Antigravity responsibilities

Antigravity should:

- Inspect the actual repository.
- Create/edit files.
- Run commands.
- Install required dependencies.
- Run tests.
- Run builds.
- Inspect runtime errors.
- Implement approved changes.
- Report actual verification results.

### Important

Neither agent should blindly overwrite the work of the other.

Before making substantial changes:

- Inspect current implementation.
- Preserve working functionality.
- Modify only what is necessary.
- Verify after changes.

---

# 45. When ChatGPT Provides Code

If ChatGPT provides implementation code or a file specification:

- Treat it as implementation guidance.
- Adapt it to the actual repository structure.
- Do not blindly paste code if existing architecture differs.
- Resolve imports and types against the current codebase.
- Run tests after integration.
- Fix compatibility issues rather than duplicating functionality.

The final repository must remain coherent and understandable.

---

# 46. When Antigravity Encounters an Error

Do not repeatedly guess at fixes.

If an error cannot be resolved confidently:

1. Capture the complete relevant error.
2. Identify the affected file and operation.
3. Stop making unrelated changes.
4. Report the error clearly.
5. Ask ChatGPT/user for assistance when appropriate.

Do not hide or suppress the error just to complete the phase.

---

# 47. ChatGPT Review Loop

For important phases, use this workflow:

````text
Phase Prompt
     â†“
Antigravity implements
     â†“
Run tests/build
     â†“
Collect results
     â†“
ChatGPT reviews
     â†“
Fix issues
     â†“
Run tests again
     â†“
Phase accepted
     â†“
Next phase

### And yes â€” I can generate the actual code

For example, when we start **Phase 0**, I won't just tell you:

> "Create an Express server."

I can produce the actual implementation structure and code, such as:

```text
reachinbox-scheduler/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ api/
â”‚   â””â”€â”€ web/
â”œâ”€â”€ packages/
â”‚   â””â”€â”€ shared/
â”œâ”€â”€ infrastructure/
â”‚   â””â”€â”€ docker/
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ .env.example
â”œâ”€â”€ .gitignore
â”œâ”€â”€ package.json
â”œâ”€â”€ tsconfig.json
â””â”€â”€ AGENTS.md





# Human-Written, Production-Grade Code Rules

These rules apply to every phase of the ReachInbox assignment.

The goal is to produce code that is:

* Production-grade
* Original
* Readable
* Maintainable
* Easy for a developer to understand
* Consistent across the repository
* Appropriate for a real engineering team

Do NOT optimize for generating the maximum amount of code.

Optimize for correct, understandable engineering.

---

## 1. Write Code a Human Developer Would Actually Maintain

Code should feel natural and intentional.

Prefer:

```ts
const scheduledEmail = await emailRepository.create(input);

const delay = getScheduleDelay(scheduledEmail.scheduledAt);

await emailQueue.add(
  "send-email",
  { emailId: scheduledEmail.id },
  { delay }
);
````

over unnecessarily abstract or clever code.

Avoid:

- excessive functional programming
- unnecessary one-line expressions
- deeply nested abstractions
- excessive generic utilities
- unnecessary design patterns
- over-engineering simple functionality

---

# 2. Prefer Readability Over Cleverness

Bad:

```ts
const result = await Promise.all(
  items.map(async (item) => (condition(item) ? process(item) : fallback(item)))
);
```

when the logic becomes difficult to understand.

Prefer clear code:

```ts
const results = [];

for (const item of items) {
  if (condition(item)) {
    results.push(await process(item));
    continue;
  }

  results.push(await fallback(item));
}
```

Performance should still be considered, but clarity is important.

---

# 3. Use Meaningful Names

Prefer:

```ts
scheduledEmail;
senderId;
scheduledAt;
hourlyLimit;
rateLimitKey;
queueJobId;
smtpMessageId;
```

Avoid:

```ts
data;
obj;
item;
temp;
x;
result2;
payload2;
foo;
bar;
```

Short names are acceptable for genuinely local concepts such as:

```ts
i;
id;
db;
req;
res;
```

when their meaning is obvious from context.

---

# 4. Keep Functions Small

A function should have one clear responsibility.

Avoid functions such as:

```ts
processEverything();
```

that:

- validate requests
- access the database
- schedule BullMQ jobs
- send emails
- update Elasticsearch
- send Slack notifications

all in one place.

Prefer:

```text
controller
   â†“
service
   â†“
repository
   â†“
queue
```

and separate responsibilities appropriately.

---

# 5. Do Not Over-Abstraction

Do not create abstractions simply because they look "enterprise."

For example, do not create:

```text
EmailFactory
EmailFactoryProvider
EmailFactoryProviderResolver
EmailProcessingStrategyFactory
```

when a simple service is enough.

Introduce an abstraction when it provides a real benefit such as:

- replacing an implementation
- testing
- separating infrastructure from business logic
- handling multiple providers
- enforcing a meaningful boundary

Every abstraction should have a reason.

---

# 6. Comments Should Explain WHY

Do not write comments that simply repeat the code.

Bad:

```ts
// Get user
const user = await userRepository.findById(userId);
```

Good:

```ts
// We load the user before scheduling so the job contains only the
// stable user ID rather than copying potentially stale account data.
const user = await userRepository.findById(userId);
```

Comments should explain:

- why something exists
- why a non-obvious decision was made
- important edge cases
- concurrency considerations
- reliability considerations

Do not comment every line.

---

# 7. Avoid AI-Looking Boilerplate

Do not generate repetitive comments such as:

```ts
// This function handles...
// This service is responsible for...
// Initialize the...
// Create the...
```

unless the explanation adds real value.

Avoid excessive section headers inside every file.

Avoid unnecessarily verbose JSDoc for obvious functions.

---

# 8. Keep Imports Clean

Do not create giant import blocks containing unused dependencies.

Use the project's formatter/linter.

Remove unused imports.

Avoid importing an entire library when only one function is needed, where the library supports selective imports.

---

# 9. TypeScript

Use TypeScript properly.

Prefer:

```ts
interface ScheduleEmailInput {
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt: Date;
}
```

over:

```ts
const input: any = ...
```

Avoid `any`.

If `any` is genuinely unavoidable, document why.

Prefer explicit return types for important public functions and service boundaries.

Use discriminated unions where they make state handling clearer.

Do not use TypeScript tricks simply to make code look sophisticated.

---

# 10. Error Handling Should Be Intentional

Do not write:

```ts
try {
  ...
} catch {
  return null;
}
```

just to suppress errors.

Errors should either:

- be handled meaningfully
- be transformed into a domain/application error
- be logged and rethrown
- be handled by centralized middleware

Do not hide failures.

---

# 11. Production-Grade Does NOT Mean Over-Engineered

Production-grade means the application handles real-world failure cases.

It does NOT mean:

- hundreds of unnecessary files
- excessive abstractions
- unnecessary microservices
- complicated patterns everywhere
- huge configuration systems

Prefer a clean modular monolith for this assignment.

---

# 12. Database Code

Database operations must be clear.

Use transactions where multiple related writes must succeed together.

Use:

- indexes
- unique constraints
- foreign keys
- proper timestamps
- appropriate data types

Do not perform important state transitions using multiple unrelated queries when an atomic transaction is required.

---

# 13. Queue Code

BullMQ code must be explicit and understandable.

A developer should be able to follow:

```text
API request
    â†“
Database record
    â†“
Queue job
    â†“
Delayed execution
    â†“
Worker
    â†“
Rate limit
    â†“
Idempotency
    â†“
SMTP
    â†“
Database update
    â†“
Search indexing
```

Do not hide this flow behind unnecessary abstractions.

---

# 14. Concurrency Code

Concurrency-sensitive code must be written defensively.

Assume:

```text
multiple workers
multiple processes
multiple requests
```

can operate simultaneously.

Do not rely on:

```ts
let isProcessing = false;
```

or other process-local state for distributed coordination.

Use:

- database constraints
- transactions
- Redis atomic operations
- BullMQ mechanisms
- appropriate locks

where required.

---

# 15. Idempotency Code

Idempotency must be obvious from the code.

A developer reviewing the worker should be able to understand:

```text
Is this email already sent?
        â†“
Yes â†’ stop safely
No
 â†“
Atomically claim processing
 â†“
Send
 â†“
Persist result
```

Do not hide critical idempotency behavior inside obscure utilities.

---

# 16. Rate Limiting Code

The rate limiter should clearly show:

```text
Identify sender
      â†“
Identify hour window
      â†“
Atomically check/increment Redis counter
      â†“
Limit available?
   â†™       â†˜
 YES       NO
 â†“          â†“
Send       Reschedule
```

The implementation must remain safe when multiple workers run simultaneously.

Do not use in-memory counters.

---

# 17. Configuration

Never hardcode operational settings such as:

```ts
const MAX_EMAILS_PER_HOUR = 200;
```

Use environment/configuration:

```env
MAX_EMAILS_PER_HOUR=200
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
```

Access configuration through a centralized typed configuration module rather than reading `process.env` throughout the entire application.

---

# 18. Logging

Logs should be useful to a developer investigating a production problem.

Good:

```text
Email job started
jobId=...
emailId=...
senderId=...
```

Good:

```text
Hourly sender limit reached
senderId=...
window=...
rescheduleAt=...
```

Do not log:

- passwords
- OAuth access tokens
- API keys
- SMTP passwords
- Slack tokens
- session secrets

Avoid excessive logs for normal successful operations.

---

# 19. API Code

Keep Express controllers thin.

Prefer:

```text
Route
  â†“
Controller
  â†“
Service
  â†“
Repository
```

Example:

```ts
export async function scheduleEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const input = scheduleEmailSchema.parse(req.body);

    const email = await emailService.schedule(input);

    res.status(201).json(email);
  } catch (error) {
    next(error);
  }
}
```

The controller should not contain the complete scheduling algorithm.

---

# 20. Frontend Code Style

Frontend code should also look naturally written.

Avoid giant components such as:

```text
Dashboard.tsx = 1500 lines
```

Separate meaningful components:

```text
Dashboard
â”œâ”€â”€ Header
â”œâ”€â”€ EmailTabs
â”œâ”€â”€ ScheduledEmailTable
â”œâ”€â”€ SentEmailTable
â”œâ”€â”€ ComposeEmailModal
â””â”€â”€ EmptyState
```

But do not split tiny pieces into components unnecessarily.

---

# 21. React State

Keep state close to where it is used.

Do not introduce global state management unless the application actually needs it.

Use appropriate tools such as:

- React state
- context where appropriate
- server state/data fetching library if justified

Do not add Redux simply because it is popular.

---

# 22. UI Components

Reusable components should be genuinely reusable.

Examples:

```text
Button
Input
Modal
Table
Badge
Toast
LoadingState
EmptyState
```

Do not create a separate component for every `<div>`.

---

# 23. Frontend API Layer

Do not scatter raw `fetch()` calls throughout components.

Prefer a small API layer:

```text
lib/
services/
api/
```

For example:

```ts
emailService.schedule(...)
emailService.getScheduled(...)
emailService.getSent(...)
```

This keeps UI components focused on UI.

---

# 24. Validation

Validate input on both:

### Frontend

For good UX.

### Backend

For security and correctness.

Never trust frontend validation.

---

# 25. Async Code

Prefer readable async/await.

Avoid deeply nested promises.

Good:

```ts
const user = await userRepository.findById(userId);

const email = await emailRepository.create(input);

await queue.add('send-email', {
  emailId: email.id,
});
```

Use `Promise.all()` when operations are genuinely independent and parallel execution is safe.

---

# 26. Avoid Magic Numbers

Bad:

```ts
if (attempts > 3) {
```

Prefer configuration or a named constant when the value has domain meaning:

```ts
const MAX_SEND_ATTEMPTS = 3;
```

For operational settings, prefer environment configuration.

---

# 27. Avoid Copy-Paste

If the same business logic appears in multiple places:

1. Identify the duplicated behavior.
2. Determine whether it belongs in a shared service/helper.
3. Extract it only if the abstraction is clear.

Do not prematurely abstract code that is still evolving.

---

# 28. Do Not Rewrite Working Code Without Reason

If existing code already works:

- inspect it
- understand it
- preserve it

Do not rewrite an entire file merely because your preferred style is different.

If refactoring is needed, explain the reason and keep the change focused.

---

# 29. Do Not Fake Production Behavior

Never replace real requirements with fake behavior.

Do not use:

```ts
console.log('Slack notification sent');
```

instead of calling Slack.

Do not use:

```ts
setTimeout(...)
```

instead of persistent BullMQ scheduling.

Do not use:

```ts
const emails = [...]
```

instead of PostgreSQL.

Do not use:

```ts
emails.filter(...)
```

as a replacement for Elasticsearch when Elasticsearch search is required.

Do not use fake Google users instead of OAuth.

---

# 30. Handle Failure Paths

Every external dependency can fail.

Consider failures from:

- PostgreSQL
- Redis
- BullMQ
- Ethereal SMTP
- Elasticsearch
- Google OAuth
- Slack API

The application should fail safely.

Do not mark an email as successfully sent before the required operation actually succeeds.

Do not silently discard failed operations.

---

# 31. Production-Grade State Transitions

Important state transitions should be explicit.

Example:

```text
scheduled
    â†“
processing
    â†“
sent
```

Failure:

```text
processing
    â†“
failed
```

Rate limit:

```text
scheduled
    â†“
rate-limited
    â†“
scheduled
```

The exact state model may differ, but it must be deliberate and documented.

---

# 32. Testing Style

Tests should test behavior, not implementation details.

Prefer:

```text
Given an email scheduled for the future,
when the worker is restarted,
then the email remains scheduled and is eventually processed.
```

over tests that only verify internal function calls.

Important production scenarios must be tested.

---

# 33. Code Review Standard

Before considering a phase complete, ask:

### Can another developer understand this code quickly?

### Can the developer explain why each important piece exists?

### What happens if the process crashes?

### What happens if two workers execute simultaneously?

### What happens if Redis fails?

### What happens if PostgreSQL fails?

### What happens if SMTP fails?

### What happens if the same job executes twice?

### Are secrets protected?

### Are configuration values externalized?

### Are errors visible?

### Are critical paths tested?

If these questions cannot be answered from the implementation, improve the implementation before moving on.

---

# 34. Originality

The implementation must be independently developed.

Do not copy completed solutions from GitHub or other candidates.

Technical documentation and libraries may be used as references.

Do not intentionally imitate another repository's implementation line-for-line.

The architecture should be based on the assignment requirements and sound engineering decisions.

---

# 35. AI-Assisted Development

AI tools may assist with implementation, debugging, architecture, and documentation.

However:

- Review generated code.
- Understand generated code.
- Adapt it to the actual repository.
- Remove unnecessary generated abstractions.
- Fix inconsistencies.
- Do not blindly accept generated code.
- Do not generate large unrelated sections simply to increase code volume.

The final repository should be understandable by the developer submitting it.

---

# 36. Final Principle

Write code that looks like it was created by a competent engineer who had time to think about the system.

Not:

```text
"Generate everything."
```

Instead:

```text
Understand
   â†“
Design
   â†“
Implement
   â†“
Test
   â†“
Review
   â†“
Refine
```

The final implementation should prioritize:

1. Correctness
2. Reliability
3. Security
4. Persistence
5. Concurrency safety
6. Testability
7. Maintainability
8. Readability
9. Performance
10. UI quality
