# ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed email scheduling system featuring persistent delayed queues, multi-worker concurrency, distributed rate limiting, and real-time dashboard observability.

## Current Phase

**Phase 0: Project Foundation**

This phase establishes the monorepo workspace foundation, containerized local infrastructure (PostgreSQL & Redis), typed configuration layers, Express.js backend API skeleton with health check endpoints, Next.js 14 frontend application shell, and a shared TypeScript contracts library.

No future phase features (such as OAuth, scheduling, BullMQ workers, Elasticsearch, or Slack integrations) are implemented in this phase, adhering to the phased development guidelines in `AGENTS.md`.

---

## Tech Stack

- **Backend**: Node.js, Express.js, Strict TypeScript
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, TypeScript
- **Infrastructure**: Docker Compose, PostgreSQL 16, Redis 7
- **Shared Package**: Typed data models, constants, and API interfaces (`@reachinbox/shared`)
- **Testing**: Vitest, Supertest

---

## Monorepo Architecture

```text
.
├── apps/
│   ├── api/                 # Express backend API
│   │   ├── src/
│   │   │   ├── config/      # Typed configuration (Zod validation)
│   │   │   ├── controllers/ # Route handlers
│   │   │   ├── lib/         # Database, Redis, and logger clients
│   │   │   ├── middleware/  # Centralized error & 404 handlers
│   │   │   ├── routes/      # API endpoints (GET /health)
│   │   │   ├── app.ts       # Express app setup
│   │   │   └── server.ts    # Server lifecycle & graceful shutdown
│   │   └── tests/           # Unit & integration tests
│   │
│   └── web/                 # Next.js frontend web client
│       ├── app/             # Next.js App Router (layout, page, styles)
│       └── components/      # UI components
│
├── packages/
│   └── shared/              # Shared TypeScript contracts and constants
│       └── src/
│
├── infrastructure/
│   └── docker/              # Docker infrastructure documentation & configs
│
├── docker-compose.yml       # PostgreSQL 16 & Redis 7 container orchestration
├── .env.example             # Documented environment configuration template
├── package.json             # Root npm workspaces configuration
├── tsconfig.base.json       # Base strict TypeScript configuration
└── AGENTS.md                # Engineering constraints and development rules
```

---

## Getting Started

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Docker & Docker Compose**: For containerized PostgreSQL and Redis

### 2. Environment Setup

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

### 3. Install Dependencies

Install all monorepo workspace dependencies:

```bash
npm install
```

### 4. Start Infrastructure (PostgreSQL & Redis)

Start the persistent PostgreSQL 16 database and Redis 7 cache/queue store:

```bash
docker compose up -d
```

Verify containers are running:

```bash
docker compose ps
```

### 5. Build Shared Library

Build the `@reachinbox/shared` package:

```bash
npm run build:shared
```

### 6. Run Development Servers

Run both Backend API (`http://localhost:4000`) and Frontend (`http://localhost:3000`) concurrently:

```bash
npm run dev
```

Or run individual services independently:

```bash
# Backend only (runs on http://localhost:4000)
npm run dev:api

# Frontend only (runs on http://localhost:3000)
npm run dev:web
```

---

## Verification & Quality Commands

```bash
# Run all tests across the workspace
npm test

# Run TypeScript typechecks across all workspaces
npm run typecheck

# Build all packages and applications for production
npm run build

# Format codebase
npm run format
```

---

## Phase 0 Health Endpoint

- **Endpoint**: `GET /health` (or `GET /api/health`)
- **Sample Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-28T13:00:00.000Z",
    "uptime": 4.12,
    "environment": "development",
    "version": "0.1.0"
  }
  ```
