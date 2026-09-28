# Infrastructure & Docker

This directory houses infrastructure configuration and docker resources for the ReachInbox Email Scheduler.

## Services

- **PostgreSQL 16**: Relational storage for email jobs, users, sender accounts, and delivery logs.
- **Redis 7**: High-performance in-memory data store for BullMQ delayed queue processing, rate limiting, and distributed worker synchronization.

## Running Locally

From the root of the repository:

```bash
# Start all infrastructure services
docker compose up -d

# Check service logs
docker compose logs -f

# Check health status
docker compose ps

# Stop all services
docker compose down
```
