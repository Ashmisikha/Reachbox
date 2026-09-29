# Repository Cleanup Plan — ReachInbox

**Audit Date:** September 29, 2026  
**Repository:** `reachinbox-email-scheduler`  
**Execution Objective:** Perform a safe, production-oriented repository cleanup without changing application behavior, APIs, database schema, UI behavior, or business logic.

---

## 1. Audit & Categorization Plan

| Path | Category | Proposed Action | Reason | Runtime Risk |
| :--- | :--- | :--- | :--- | :--- |
| `package.json` | B. Required configuration | RETAIN | Root package manifest and monorepo workspace definition | High if changed |
| `package-lock.json` | B. Required configuration | RETAIN | Exact dependency lockfile for reproducible builds | High if changed |
| `tsconfig.base.json` | B. Required configuration | RETAIN | Base TypeScript compiler configuration shared across monorepo | High if changed |
| `.gitignore` | B. Required configuration | ENHANCE | Add explicit exclusions for media artifacts and scratch dirs | None |
| `.prettierrc` | B. Required configuration | RETAIN | Code formatting configuration | None |
| `docker-compose.yml` | B. Required configuration | RETAIN | Local services orchestrator for Postgres, Redis, Elasticsearch | High if changed |
| `.env.example` | B. Required configuration | RETAIN | Template environment configuration with safe placeholders | None |
| `.env` | J. Sensitive local config | RETAIN (IGNORED) | Local development credentials, properly excluded by `.gitignore` | High if deleted |
| `README.md` | E. Required documentation | RETAIN | Primary repository setup and architectural guide | None |
| `AGENTS.md` | E. Required documentation | RETAIN | Core engineering rules, assignment specifications, and constraints | None |
| `HOW_REACHINBOX_WORKS.md` | E. Required documentation | RETAIN | End-to-end architectural lifecycle documentation | None |
| `REACHINBOX_BROWSER_E2E_REPORT.md` | E. Required documentation | RETAIN | End-to-end browser and automated verification test report | None |
| `REACHINBOX_DEMO_VOICEOVER.md` | L. Duplicate documentation | REMOVE | Obsolete voiceover draft for preliminary demo; superseded by synchronized narration | None |
| `test-contacts.csv` | C. Required test fixture | RETAIN | Sample CSV fixture used for browser verification and user manual imports | None |
| `dump.rdb` | I. Build/cache artifacts | REMOVE | Generated binary Redis database dump artifact in workspace root | None |
| `apps/api/package.json` | B. Required configuration | RETAIN | Backend API service package definition & scripts | High if changed |
| `apps/api/tsconfig.json` | B. Required configuration | RETAIN | Backend TypeScript configuration | High if changed |
| `apps/api/vitest.config.ts` | B. Required configuration | RETAIN | Vitest test runner configuration | High if changed |
| `apps/api/prisma/schema.prisma` | B. Required configuration | RETAIN | Primary database schema (PostgreSQL source of truth) | Critical |
| `apps/api/prisma/migrations/**` | D. Required migrations | RETAIN | Database migration history | Critical |
| `apps/api/src/server.ts` | A. Required application source | RETAIN | Express HTTP & WebSocket server entrypoint | Critical |
| `apps/api/src/app.ts` | A. Required application source | RETAIN | Express application configuration & middleware assembly | Critical |
| `apps/api/src/config/**` | A. Required application source | RETAIN | Environment, queue, and security configuration modules | High if changed |
| `apps/api/src/controllers/**` | A. Required application source | RETAIN | API route controllers (auth, campaign, contact, etc.) | Critical |
| `apps/api/src/lib/**` | A. Required application source | RETAIN | Database, Redis, and logger utility clients | Critical |
| `apps/api/src/middleware/**` | A. Required application source | RETAIN | Authentication and error-handling middleware | Critical |
| `apps/api/src/queues/**` | A. Required application source | RETAIN | BullMQ queue definitions, processors, and redis configs | Critical |
| `apps/api/src/repositories/**` | A. Required application source | RETAIN | Data access repositories for PostgreSQL persistence | Critical |
| `apps/api/src/routes/**` | A. Required application source | RETAIN | API endpoints and route registration | Critical |
| `apps/api/src/services/**` | A. Required application source | RETAIN | Core business logic services (scheduling, smtp, rate-limiting) | Critical |
| `apps/api/src/workers/**` | A. Required application source | RETAIN | Background worker processes for BullMQ queues | Critical |
| `apps/api/tests/**` | C. Required tests | RETAIN | All 16 automated test suites (208 passing tests) | High if changed |
| `apps/api/scripts/reindex-elasticsearch.ts` | B. Operational utility | RETAIN | Elasticsearch index mapping setup and reindexing script | None |
| `apps/api/scripts/sync-sent-to-es.ts` | B. Operational utility | RETAIN | Synchronization utility for projecting DB records to ES | None |
| `apps/api/scripts/check-queue-state.ts` | B. Operational utility | RETAIN | BullMQ queue state diagnostics utility | None |
| `apps/api/scripts/execute-e2e-real-campaign.ts` | C. Required test script | RETAIN | End-to-end programmatic verification script | None |
| `apps/api/scripts/query-messages.ts` | F. Temporary debug artifact | REMOVE | One-off scratch database query script | None |
| `apps/api/scripts/test-search.ts` | F. Temporary debug artifact | REMOVE | One-off scratch search query script | None |
| `apps/web/package.json` | B. Required configuration | RETAIN | Next.js frontend package definition & dependencies | High if changed |
| `apps/web/next.config.mjs` | B. Required configuration | RETAIN | Next.js configuration | High if changed |
| `apps/web/tailwind.config.ts` | B. Required configuration | RETAIN | Tailwind CSS design system tokens and theme config | High if changed |
| `apps/web/postcss.config.mjs` | B. Required configuration | RETAIN | PostCSS compilation configuration | High if changed |
| `apps/web/tsconfig.json` | B. Required configuration | RETAIN | Frontend TypeScript configuration | High if changed |
| `apps/web/.eslintrc.json` | B. Required configuration | RETAIN | ESLint configuration | High if changed |
| `apps/web/app/**` | A. Required application source | RETAIN | Next.js 14 App Router pages, layouts, and routes | Critical |
| `apps/web/components/**` | A. Required application source | RETAIN | Reusable UI components, auth, shell, legal, slack | Critical |
| `apps/web/hooks/**` | A. Required application source | RETAIN | React state and mutation hooks | Critical |
| `apps/web/services/**` | A. Required application source | RETAIN | Frontend API client services | Critical |
| `apps/web/types/**` | A. Required application source | RETAIN | TypeScript interfaces and type definitions | High if changed |
| `packages/shared/package.json` | B. Required configuration | RETAIN | Shared workspace package manifest | High if changed |
| `packages/shared/tsconfig.json` | B. Required configuration | RETAIN | Shared package TypeScript configuration | High if changed |
| `packages/shared/src/index.ts` | A. Required application source | RETAIN | Shared types, enums, and domain contracts | Critical |
| `infrastructure/docker/README.md` | E. Required documentation | RETAIN | Infrastructure deployment documentation | None |

---

## 2. Summary of Proposed Removals

Only 4 non-functional files will be safely removed:
1. `dump.rdb` (temporary Redis binary dump generated during local dev in root)
2. `REACHINBOX_DEMO_VOICEOVER.md` (superseded duplicate preliminary voiceover draft)
3. `apps/api/scripts/query-messages.ts` (one-off debug query script)
4. `apps/api/scripts/test-search.ts` (one-off debug search test script)

All core application source, tests, migrations, configurations, operational utilities, and documentation are strictly preserved.
