# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

uMedical (formerly MedikamentenProfil.de, repo: https://github.com/cvreyher/uMedical) — a German pharmaceutical data platform that ingests EMA (European Medicines Agency) data, multi-source pharmacovigilance feeds (EMA/FDA/MHRA), and documents (SmPC/EPAR PDFs) into Postgres, and exposes them via a typed API with hybrid RAG search (pgvector + full-text). The repo started from the oNo500/nestjs-boilerplate. The project vision (architecture ranking, hybrid search design, provenance principles) lives in `docker/vision.md` (German).

Turborepo + pnpm monorepo (Node >= 22.18, pnpm 10):
- `apps/api` — NestJS 11 backend (port 3000)
- `apps/web` — Next.js 16 / React 19 frontend (port 8000)
- `packages/database` — Drizzle ORM schemas + migrations (`@workspace/database`), consumed by both apps
- `packages/ui`, `packages/icons`, `packages/eslint-config`, `packages/typescript-config` — shared tooling/UI

## Commands

```bash
pnpm install                     # root
pnpm dev                         # turbo run dev (all apps)
pnpm build / pnpm lint / pnpm check-types   # via turbo, at root

# Infrastructure (Docker: pgvector Postgres on host port 5433 + Redis on 6380)
pnpm infra:up                    # start, waits for healthchecks
pnpm infra:down                  # stop (keeps data)
pnpm infra:reset                 # stop + delete volumes + start fresh
pnpm db:setup                    # build database package + run migrations
pnpm db:seed:dev                 # seed realistic sample data for local development

# API (apps/api)
pnpm --filter api dev            # nest start --watch
pnpm --filter api test           # vitest run
pnpm --filter api test src/modules/rag/…/foo.spec.ts   # single test file
pnpm --filter api test:e2e       # vitest with vitest.e2e.config.ts

# Web (apps/web)
pnpm --filter web dev            # next dev -p 8000
pnpm --filter web test:unit      # vitest run (jsdom + testing-library, MSW mocks)
pnpm --filter web test:e2e       # playwright
pnpm --filter web generate:api   # regenerate src/types/openapi.d.ts — API must be running on :3000
```

### Database workflow (packages/database)

`drizzle.config.ts` reads schemas from `./dist/**` (compiled JS), so **build the package before any drizzle-kit command**:

```bash
cd packages/database
pnpm build           # tsc → dist/ (required first)
pnpm db:generate     # generate migration from schema changes
pnpm db:migrate      # apply migrations
pnpm db:push         # push schema directly (dev)
pnpm db:studio
pnpm db:seed         # tsx scripts/seed.ts
```

Env files: `apps/api/.env`, `apps/web/.env`, `packages/database/.env` (each has `.env.example`). `DATABASE_URL` is required in both api and database packages. `OPENAI_API_KEY` (embeddings) and `R2_*` (Cloudflare R2 document storage) are optional — related features degrade without them. Env vars are validated with Zod in `apps/api/src/app/config/env.schema.ts`; add new vars there.

**`LIVE_FETCH_ENABLED`** (apps/api/.env, default `false` in local dev): kill switch for all background cron jobs that call external APIs — the pvigilance feed scheduler (`feed-scheduler.service.ts`) and the RAG job processor (`job-processor.service.ts`). Keep it `false` during development to avoid rate limits and work with `pnpm db:seed:dev` sample data; manual admin endpoints still work, but queued jobs only process while it's `true`.

## Architecture

### API (`apps/api`) — modular DDD-lite

Path alias `@/` → `src/`. Three business modules under `src/modules/`, each split into `application/` (services + ports), `infrastructure/` (clients, repositories, parsers), `presentation/` (controllers + DTOs):

- **`ema`** — imports EMA medicine/company/substance data via `ema-api.client.ts`; serves medicines and statistics endpoints.
- **`pvigilance`** — multi-source pharmacovigilance events: feed sources are polled and parsed by per-source parsers (`rss-parser`, `fda-api-parser`, `mhra-api-parser`), normalized into `pvigilance_events` with links to products.
- **`rag`** — document pipeline: EPI/EMA document download → R2 storage → PDF extraction → section-aware chunking → OpenAI embeddings (job queue in `job-queue.service` / `job-processor.service`) → hybrid search (`search.service`, `unified-search.service`).

Cross-cutting concerns live outside modules:
- `src/shared-kernel/` — `DrizzleModule` (global DB instance), domain-events infrastructure, base domain/application classes.
- `src/app/` — env schema, Pino logger, exception filters (RFC 7807 problem details), CLS request context, interceptors (correlation id, tracing, deprecation), middleware (API versioning, ETag), Swagger config, health checks.

Swagger/OpenAPI is served at `/openapi.json` and `/openapi.yaml`; the web app's typed client is generated from it.

### Database (`packages/database`)

One table per file in `src/schemas/*.schema.ts`, cross-table relations centralized in `src/relations.ts` / `relations-extended.ts`. Core entity groups: medicinal products / substances / companies (+ join tables), documents / document-chunks / embedding-jobs (RAG), pvigilance events / feed sources / feed logs, timeline-events, shortages, procedures, referrals, import-logs. Both apps import from `@workspace/database` — schema changes ripple to API repositories and web types.

### Web (`apps/web`)

Next.js App Router with German route names: `medikamente`, `wirkstoffe` (substances), `unternehmen` (companies), `statistiken`. Data fetching is fully typed end-to-end: `openapi-fetch` + `openapi-react-query` (`src/lib/api.ts`, `fetch-client.ts`) against the generated `src/types/openapi.d.ts` — after changing API DTOs/controllers, restart the API and run `pnpm --filter web generate:api`. Feature code in `src/features/`, shared charts (ECharts, d3 timeline) in `src/components/charts` and `components/timeline`. Tests mock the API with MSW + `openapi-msw`.

## Specialized agents

Project-specific agents are configured and should be used for their domains: `umedical-architect` (MVP/architecture alignment), `data-structure-expert` (schema design), `ema-database-expert` (EMA data access), `pharma-vigilance-expert` (PV systems, FAERS/EudraVigilance).
