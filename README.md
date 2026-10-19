# job-app

A personal job-search backend: it discovers jobs from official public job-board APIs, normalizes and de-duplicates them, extracts requirements, and scores each posting against your candidate profile with an explainable match.

This repository is the NestJS API and background worker. The browser UI lives in a separate repository (`job-app-ui`, a Vite app; see [ADR 0006](docs/adr/0006-separate-repos-for-frontend-and-backend.md)).

## What it does

- **Auth**: register and log in with JWT-based authentication.
- **Candidate profile**: CRUD for the profile plus experience, education, skills, projects, certifications, achievements and links.
- **Job preferences**: target roles, locations, salary floor, employment types, excluded companies and keywords.
- **Job ingestion**: normalizes postings into a canonical Job Posting while preserving the raw Source Posting.
  - Manual paste for sources with no permitted automated access (such as LinkedIn and Glassdoor). The server never fetches those domains.
  - Generic URL fetch for other pages, with a denylist for those domains.
- **Job discovery**: scheduled, rate-limited discovery from Greenhouse, Lever, Ashby and SmartRecruiters via isolated source adapters, plus a configurable list of watched companies. Runs on a BullMQ queue, every 6 hours by default and configurable per source.
- **De-duplication**: Source Postings for the same real-world job are grouped into a Job Cluster.
- **Requirement extraction**: pulls requirements out of job descriptions, with a re-extract endpoint.
- **Matching**: a deterministic match score (hard filters plus requirement-to-evidence overlap) that always returns reasons and gaps. Semantic and LLM scoring are planned as a later layer ([ADR 0003](docs/adr/0003-deterministic-first-matching.md)).
- **Dashboard**: aggregate API for the UI.

Domain vocabulary is defined in [CONTEXT.md](CONTEXT.md); design decisions are in [docs/adr](docs/adr).

## Tech stack

NestJS 10, TypeScript, Prisma 5 with PostgreSQL 16, Redis 7 with BullMQ, Passport JWT, class-validator, Jest and Supertest, pnpm.

## Project layout

```
src/
  auth/               registration, login, JWT guard
  candidate-profile/  profile and entry CRUD (experience, education, skills, ...)
  job-preferences/    search criteria
  job-postings/       normalization, manual paste, generic fetch, clusters, requirement extraction
  job-discovery/      scheduler, queue processor, source adapters, watched companies
  matching/           hard filters, requirement matcher, scoring
  dashboard/          dashboard API
  common/             response envelope interceptor and filter
  main.ts             API entry point
  worker.ts           worker entry point
prisma/               schema and migrations
test/                 end-to-end specs (one per feature area)
docs/adr/             architecture decision records
.scratch/             local markdown issue tracker and Phase 1 spec
```

## Prerequisites

- Node.js 22
- pnpm (via `corepack enable`)
- Docker and Docker Compose, for Postgres and Redis

## Getting started

```bash
pnpm install
cp .env.example .env        # then edit JWT_SECRET
docker compose up -d postgres redis
pnpm prisma:generate
pnpm prisma:deploy          # apply migrations (use pnpm prisma:migrate while developing the schema)
pnpm start:dev              # API on http://localhost:3000
pnpm start:worker           # in a second terminal
```

Postgres is published on host port 5434 and Redis on 6381, matching `.env.example`.

You can also run the API and worker in containers with `docker compose up`. The compose file mounts the source tree and runs the dev servers; it points both services at the compose Postgres and Redis.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (BullMQ) |
| `JWT_SECRET` | Secret used to sign JWTs (required) |
| `ANTHROPIC_API_KEY` | Listed in `.env.example` for the LLM gateway ([ADR 0004](docs/adr/0004-llm-gateway-abstraction.md)); not read by the current code |
| `FRONTEND_URL` | Optional. Allowed CORS origin, defaults to `http://localhost:5173` |
| `PORT` | Optional. API port, defaults to `3000` |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm start:dev` | API with watch mode |
| `pnpm start` | API without watch |
| `pnpm start:worker` | Background worker |
| `pnpm build` | Compile with the Nest CLI |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint over `src` and `test` |
| `pnpm test` | Jest unit tests |
| `pnpm test:e2e` | End-to-end tests |

The e2e suite needs the Postgres and Redis containers running. Its global setup creates a separate `job_app_test` database, applies migrations to it, and uses Redis database index 1, so dev data is not touched.

## API overview

Controllers are mounted at: `auth`, `candidate-profile` (plus `candidate-profile/{experience,education,skill,project,certification,achievement,link}`), `job-preferences`, `job-postings` (plus `job-postings/manual-paste` and `job-postings/fetch-url`), `job-clusters`, `discovery` (plus `discovery/watched-companies`) and `dashboard`. Responses use a common envelope ([ADR 0007](docs/adr/0007-response-envelope.md)). See the controllers in `src/` for exact routes.

## Deployment

Deployment is local-only through Docker Compose for now, with secrets kept in `.env` ([ADR 0002](docs/adr/0002-tech-stack.md)). No cloud deployment is set up.

## Status

Phase 1 (MVP) tickets 01 through 12 are implemented on the backend; see `.scratch/phase-1-mvp/`. Automatic application submission and LLM-based tailoring are later phases. No license file is included.
