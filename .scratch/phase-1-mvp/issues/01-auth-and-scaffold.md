# 01 — Auth + project scaffold

**What to build:** The project's foundation — a running NestJS API, Postgres, Redis, and a worker process, all wired up via Docker Compose (per [[0002-tech-stack]]), with a single local user who can register once, log in, and receive a JWT that protects everything else. This is the seam every other ticket builds on: Seam 1 (HTTP API + real test DB) and Seam 2 (`JobSourceAdapter` interface, exercised starting in ticket 07) both depend on this existing first.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `docker compose up` starts API, worker, Postgres, Redis containers successfully
- [ ] A single local user can be created (email + bcrypt-hashed password) — no open self-registration beyond the one local account, per [[0005-solo-first-forward-compatible-ownership]]
- [ ] Login issues a JWT; a protected test endpoint rejects requests without a valid JWT and accepts requests with one
- [ ] Every domain table created from this point forward carries a `user_id` column, enforced server-side on every query (no frontend-only filtering)
- [ ] Secrets (DB credentials, JWT signing secret, Anthropic API key placeholder) load from `.env`, are never logged
- [ ] e2e test (Seam 1: supertest + real Postgres test DB) covers register → login → access protected endpoint → rejected without token
