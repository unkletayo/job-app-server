# 08 — Greenhouse + Lever adapters

**What to build:** Real automated discovery from two Sanctioned Sources — Greenhouse (`boards-api.greenhouse.io`) and Lever (`api.lever.co`) — both unauthenticated, publicly documented JSON job-board APIs, registered with the scheduler from ticket 07.

**Blocked by:** 07 — needs the scheduler/adapter harness to plug into.

**Status:** done

- [x] `GreenhouseAdapter` implements `JobSourceAdapter`, calling the public Job Board API, normalizing results into Job Postings via the ticket 04 pipeline
- [x] `LeverAdapter` implements `JobSourceAdapter` the same way against the public Postings API
- [x] Both adapters are isolated per [[0001-source-integration-policy]] and PRD §7 — a failure or format change in one cannot break the other
- [x] Both respect the rate-limit/backoff and incremental-checkpointing behavior from ticket 07
- [x] e2e/integration tests exercise each adapter against a recorded/fixture response (not live network calls in CI), proving correct normalization and checkpoint advancement

## Comments

**Gap surfaced and resolved before implementing**: neither Greenhouse's Job Board API nor Lever's Postings API has a "search everything" endpoint — each requires a specific company board token/slug. Nothing in the spec/schema said how the user picks which companies to watch, so this was a real product decision, not something to invent silently — asked the user, who chose "new config list." Added `WatchedCompany` (`prisma/schema.prisma`): per-user rows of `{source, boardToken, label}`, unique on `(userId, source, boardToken)`. `label` is required (not optional) because neither API reliably returns a company display name on the list-jobs response — the user supplies it at watch-time. CRUD lives at `/discovery/watched-companies` (`src/job-discovery/watched-companies/`), same ownership/atomicity patterns as `EntryCrudService` (`deleteMany` scoped by `userId`, not a separate existence check then delete).

**Adapters implement `DiscoverableSourceAdapter` (ticket 07's interface), not `JobSourceAdapter`** — the ticket text says `JobSourceAdapter` but that interface is for the on-demand search/apply flow (`ManualPasteAdapter`'s shape); the scheduler (ticket 07) only ever calls `DiscoverableSourceAdapter.fetchPage`. Registered into `DISCOVERY_ADAPTERS` via a factory in `job-discovery.module.ts` keyed by each adapter's own `sourceKey`, replacing ticket 07's empty-`{}` default now that real adapters exist.

**Verified against the real public APIs directly** (not just training-data recall) before writing the adapters: fetched Greenhouse's and Lever's own API docs live to confirm exact response shapes, pagination, and filter support. Key finding that shaped the design — **neither API supports server-side incremental filtering**, and each has a different limitation:
- Greenhouse: no pagination, no `since`/`updated_after` param, but each job has `updated_at`. `GreenhouseAdapter` filters client-side: `checkpoint.cursor` holds the previous run's timestamp, only jobs with a newer `updated_at` are returned.
- Lever: no pagination filter used (fetches up to 200 postings per board in one call), and **no timestamp field on postings at all** — nothing to filter by time. `LeverAdapter` instead persists a JSON-encoded set of every previously-seen `sourceJobId` in `checkpoint.cursor` and skips anything already in it. This is a deliberate, documented adaptation to what Lever's API actually exposes, not an approximation of Greenhouse's approach — noted in the adapter's own comment so a future reader doesn't "fix" it into matching Greenhouse's pattern.

Both clients (`GreenhouseClient`, `LeverClient`) are thin, separately-injectable HTTP boundaries — the only place either adapter calls `fetch()`. Tests override just the client via `overrideProvider`, exercising the real adapter's normalization/checkpoint logic against fixtures (never a live network call in the test suite). Each adapter also catches a single watched board's fetch failure and skips it (logged, not thrown) rather than failing the whole run — cross-source isolation (Greenhouse vs. Lever) was already structural from ticket 07's `DiscoveryCycleService`; this is the same principle one level down, across boards within one source, and is covered by its own test (`greenhouse-adapter.e2e-spec.ts`'s "skips a board whose fetch fails" case).

New e2e files: `greenhouse-adapter.e2e-spec.ts` (normalization, checkpoint advancement across 3 runs including a merge-vs-create case, per-board failure resilience), `lever-adapter.e2e-spec.ts` (normalization, seen-id-set incremental behavior), `watched-companies.e2e-spec.ts` (CRUD, unsupported-source rejection, duplicate-watch conflict, cross-user isolation). Full e2e suite: 41/41 across 10 files. `tsc --noEmit` and `nest build` clean.

**Live-verified against the real, live Greenhouse API** (not just fixtures) via the running Docker `api` container: watched the real `robinhood` Greenhouse board, triggered a real run — 155 real jobs fetched/normalized/created from `boards-api.greenhouse.io` into real Postgres rows with correct company/title/location/applicationUrl. A second run against the same live API fetched 0 (checkpoint correctly filtered every unchanged job), proving the incremental behavior holds against the real external API, not just mocks. Lever wasn't live-verified the same way (no real company slug on hand to test against) — relies on the fixture-based e2e coverage plus the documented API-shape research.
