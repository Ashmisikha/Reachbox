# Infrastructure & Docker

This directory houses infrastructure configuration and docker resources for the ReachInbox Email Scheduler.

## Services

- **PostgreSQL 16**: Relational storage for email jobs, users, sender accounts, campaigns, and delivery logs.
- **Redis 7**: In-memory data store for BullMQ delayed queue processing, atomic rate limiting, and distributed worker synchronization.
- **Elasticsearch 8.13.4**: Search engine for asynchronous full-text indexing and multi-field email search.

## Running Locally

From the root of the repository:

```bash
# Start all infrastructure services (PostgreSQL, Redis, Elasticsearch)
npm run docker:up
# or: docker compose up -d

# Check service logs
npm run docker:logs
# or: docker compose logs -f

# Check health status
docker compose ps

# Stop all services
npm run docker:down
# or: docker compose down
```
