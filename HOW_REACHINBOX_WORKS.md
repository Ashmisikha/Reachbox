# How ReachInbox Works — Plain English Architecture & Lifecycle

This document explains exactly how ReachInbox functions from the moment a user uploads contacts to the moment an email lands in a recipient's inbox and displays in the analytics dashboard.

---

## 1. What You Upload
You upload a CSV file containing your prospect list:
- Columns: `firstName`, `lastName`, `email`, `company`, `jobTitle`
- ReachInbox validates every record: checks email syntax (RFC 5322), strips whitespace, deduplicates entries, and rejects malformed rows.
- The contacts are persisted directly into your isolated workspace in **PostgreSQL**.

---

## 2. What You Create
You create two core entities:
1. **Email Template**: Reusable content containing dynamic handlebar tags like `{{firstName}}` and `{{company}}`.
2. **Campaign**: Connects your chosen contacts, email template, sender mailbox (e.g. Ethereal SMTP), and dispatch rules (e.g. Start Time, Minimum Delay between sends, Hourly Rate Limit).

---

## 3. What Happens When You Click "Schedule"
When you click **Schedule Campaign** in the browser:
1. The browser sends a single HTTP `POST /api/campaigns` request to the Express API.
2. The API creates the campaign in PostgreSQL with status `SCHEDULED`.
3. For each recipient, it inserts an `EmailMessage` record with status `SCHEDULED`.
4. It calculates the exact execution timestamp for each email, incorporating:
   - Initial campaign start time
   - Inter-email throttle delay (`MIN_EMAIL_DELAY_MS`, e.g. 2000ms offsets between consecutive recipients)
   - Hourly capacity allocations
5. The API publishes delayed job payloads to **BullMQ** via **Redis**.
6. **No cron jobs, `node-cron`, or `setInterval` timers are ever used.** Everything is managed by persistent Redis timers.

---

## 4. Where the Job Goes
The jobs are stored inside the BullMQ `email-dispatch` queue within Redis memory and persisted to disk (`dump.rdb` / AOF).
Even if the entire server, API, or worker crashes or is restarted, the jobs remain safely queued in Redis with their target timestamps intact.

---

## 5. What BullMQ Does
BullMQ manages the job lifecycle and queue state machine:
- **DELAYED**: The job sits in a sorted set (ZSET) indexed by its target Unix timestamp.
- **WAITING**: Once the target timestamp arrives, BullMQ automatically moves the job into the active execution stream.
- **ACTIVE**: A free worker thread picks up the job and begins execution.
- **COMPLETED**: The email has been transmitted via SMTP, and state is finalized.
- **FAILED**: If a network or SMTP error occurs, BullMQ handles exponential backoff retries without duplicating sends.

---

## 6. What Redis Does
Redis acts as the ultra-fast, distributed coordination engine:
- Stores queue metadata, job payloads, and execution locks.
- Tracks atomic hourly rate limits (`email-rate-limit:{senderId}:{hourWindow}`).
- Coordinates distributed worker concurrency (`WORKER_CONCURRENCY=5`), ensuring that multiple workers across different processes never send emails out of order or violate rate limits.

---

## 7. What the Worker Does
The background worker executes the job through an atomic, multi-stage pipeline:
1. **Idempotency Lock**: Acquires an atomic lock in Redis/PostgreSQL for the `EmailMessage` ID. If the message was already sent or is currently being sent by another worker, it aborts immediately.
2. **Suppression Check**: Verifies that the recipient email is not present on the global suppression list. If suppressed, it marks the message as `SUPPRESSED` and skips sending.
3. **Rate Limit Verification**: Queries Redis for the sender's current hourly usage. If the limit is reached, it automatically reschedules the job for the start of the next hour.
4. **Throttle Enforcement**: Enforces the minimum send delay (`MIN_EMAIL_DELAY_MS`) using distributed Redis markers.
5. **Personalization Rendering**: Replaces tags like `{{firstName}}` and `{{company}}` with the recipient's real data.
6. **SMTP Transmission**: Dispatches the email through Nodemailer to the SMTP server.
7. **State Persistence**: Updates PostgreSQL status from `PROCESSING` to `SENT`, records the SMTP Message ID, and indexes the event into **Elasticsearch**.

---

## 8. What the Rate Limiter Does
- Tracks outgoing emails per sender per hour using an atomic Redis counter.
- If a sender has an hourly limit of `100` and receives a 101st email in that hour:
  - The email is **never dropped** and **never marked as failed**.
  - The worker calculates the millisecond offset to the next hour window.
  - The job is rescheduled in BullMQ with a delay until `startOfNextHour`.
  - A real Slack alert is fired via Slack OAuth webhook notifying the team of the throttling event.

---

## 9. What SMTP Does
- ReachInbox connects via TLS to the configured SMTP server (e.g. Ethereal Email for development/testing, or Amazon SES/SendGrid in production).
- Nodemailer negotiates the SMTP handshake, transfers the MIME message body, and receives the unique SMTP server Message ID.
- In Ethereal Email, an instant web preview URL is generated, allowing the exact visual rendering, headers, and personalization to be verified.

---

## 10. Where You See the Result
1. **Ethereal Preview URL**: Open the message URL directly in your browser to inspect the exact delivered email.
2. **Queue Monitor Dashboard** (`/dashboard/queues`): View real-time BullMQ job states (Delayed → Waiting → Active → Completed).
3. **Campaign Analytics** (`/dashboard/campaigns/[id]`): Displays real metrics (Recipients: 3, Sent: 1, Scheduled: 2, Suppressed: 0) directly from PostgreSQL.
4. **Global Search** (`/dashboard/search`): Real-time Elasticsearch index searching across recipients, subjects, and campaign names.

---

## End-to-End Architecture Flow Diagram

```text
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  - Import CSV (3 contacts)                                                        |
|  - Create Template with {{firstName}} & {{company}}                               |
|  - Compose Campaign "Real E2E Outreach"                                           |
|  - Click "Schedule Campaign"                                                      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTP POST /api/campaigns
                                          v
+-----------------------------------------------------------------------------------+
|                                  EXPRESS API                                      |
|  - Validates payload & recipient list                                             |
|  - Writes Campaign & 3 EmailMessages to PostgreSQL (Status: SCHEDULED)            |
|  - Computes sequential offsets (T+0s, T+2s, T+4s)                                 |
|  - Pushes delayed jobs into BullMQ queue                                          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Enqueue delayed jobs
                                          v
+-----------------------------------------------------------------------------------+
|                                REDIS + BULLMQ                                     |
|  - Stores job state in Redis sorted set (ZSET)                                    |
|  - Survives process restarts without data loss                                    |
|  - Promotes DELAYED -> WAITING when target timestamp arrives                      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Worker poll / event trigger
                                          v
+-----------------------------------------------------------------------------------+
|                             BULLMQ BACKGROUND WORKER                              |
|  1. Atomic Idempotency check (prevent duplicate send)                             |
|  2. Suppression list check (abort if recipient suppressed)                        |
|  3. Hourly rate limit check (atomic Redis counter)                                |
|  4. Minimum send delay enforcement (MIN_EMAIL_DELAY_MS)                           |
|  5. Personalization render: "Hi Omm, Company: ReachInbox"                         |
|  6. Dispatch via Nodemailer                                                       |
+--------------------+--------------------+--------------------+--------------------+
                     |                    |                    |
          SMTP Send  |         Update DB  |    Index Document  | Slack Alert (if capped)
                     v                    v                    v                    v
         +---------------+    +---------------+    +---------------+    +---------------+
         | ETHEREAL SMTP |    |  POSTGRESQL   |    | ELASTICSEARCH |    |  SLACK OAUTH  |
         | Real Delivery |    | Status: SENT  |    | Search Index  |    | Webhook Alert |
         | Message ID &  |    | Timestamp     |    | Campaign &    |    | "Rate limit   |
         | Web Preview   |    | Message ID    |    | Message Text  |    |  approaching" |
         +---------------+    +---------------+    +---------------+    +---------------+
```

---

## Detailed Email Lifecycle State Machine

```text
                     [ User Schedules Campaign ]
                                  |
                                  v
                        +-------------------+
                        |     SCHEDULED     | <--- Persisted in PostgreSQL
                        +-------------------+
                                  |
                                  | BullMQ promotes job
                                  v
                        +-------------------+
                        |    PROCESSING     | <--- Worker acquires atomic lock
                        +-------------------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
    (Suppressed?)          (Rate-limited?)       (SMTP Success)
            |                     |                     |
            v                     v                     v
   +-----------------+   +-----------------+   +-----------------+
   |   SUPPRESSED    |   |    RESCHEDULED  |   |      SENT       |
   | - Not sent      |   | - BullMQ delay  |   | - Delivered     |
   | - Logged        |   |   to next hour  |   | - Message ID    |
   +-----------------+   +-----------------+   | - ES Indexed    |
                                               +-----------------+
                                                        |
                                                (Network failure?)
                                                        |
                                                        v
                                               +-----------------+
                                               |     FAILED      |
                                               | - Auto-retry x3 |
                                               | - Failure log   |
                                               +-----------------+
```
