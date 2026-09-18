# 01 — Auth + project scaffold

**What to build:** The project's foundation — a running NestJS API, Postgres, Redis, and a worker process, all wired up via Docker Compose (per [[0002-tech-stack]]), with a single local user who can register once, log in, and receive a JWT that protects everything else. This is the seam every other ticket builds on: Seam 1 (HTTP API + real test DB) and Seam 2 (`JobSourceAdapter` interface, exercised starting in ticket 07) both depend on this existing first.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `docker compose up` starts API, worker, Postgres, Redis containers successfully
- [x] A single local user can be created (email + bcrypt-hashed password) — no open self-registration beyond the one local account, per [[0005-solo-first-forward-compatible-ownership]]
- [x] Login issues a JWT; a protected test endpoint rejects requests without a valid JWT and accepts requests with one
- [x] Every domain table created from this point forward carries a `user_id` column, enforced server-side on every query (no frontend-only filtering) — no owned tables exist yet (only `users` itself), this is a forward constraint for ticket 02+
- [x] Secrets (DB credentials, JWT signing secret, Anthropic API key placeholder) load from `.env`, are never logged
- [x] e2e test (Seam 1: supertest + real Postgres test DB) covers register → login → access protected endpoint → rejected without token

## Comments

Implemented in 245dfc4, reviewed via `/code-review` against 5384207. Findings fixed in fefc157:
- DB-enforced singleton guard (unique constraint) replaces the racy `count()`-only check.
- Dedicated `job_app_test` database for e2e tests — no longer runs against the dev DB.
- Missing `ANTHROPIC_API_KEY` placeholder added to `.env.example`.
- Test-helper duplication cleaned up.

Repo structure note: this repo is backend-only (see [[0006-separate-repos-for-frontend-and-backend]]) — started as an `apps/api` monorepo, corrected mid-ticket.
