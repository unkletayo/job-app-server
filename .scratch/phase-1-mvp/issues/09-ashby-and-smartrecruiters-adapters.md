# 09 — Ashby + SmartRecruiters adapters

**What to build:** Real automated discovery from the remaining two Sanctioned Sources — Ashby (`api.ashbyhq.com/posting-api`) and SmartRecruiters (Posting API) — both official, documented, unauthenticated-for-reads job-board APIs.

**Blocked by:** 07 — needs the scheduler/adapter harness to plug into.

**Status:** done

- [x] `AshbyAdapter` implements `JobSourceAdapter` against the public Job Postings API
- [x] `SmartRecruitersAdapter` implements `JobSourceAdapter` against the public Posting API
- [x] Both adapters are isolated per [[0001-source-integration-policy]] and PRD §7
- [x] Both respect the rate-limit/backoff and incremental-checkpointing behavior from ticket 07
- [x] e2e/integration tests exercise each adapter against a recorded/fixture response (not live network calls in CI), proving correct normalization and checkpoint advancement

## Comments

Same shape as ticket 08: `AshbyAdapter`/`SmartRecruitersAdapter` implement `DiscoverableSourceAdapter` (ticket 07), registered into `DISCOVERY_ADAPTERS`, watched via `WatchedCompany` (extended `WATCHABLE_SOURCES` to include `ashby`/`smartrecruiters` — no schema change needed, the table was already source-agnostic).

**Verified both APIs live before implementing** (docs summaries proved unreliable for SmartRecruiters — see below): Ashby's public `posting-api/job-board/{boardToken}` returns `{jobs, apiVersion}`; each job has `publishedAt` (a creation-time signal, not last-edited) but no pagination/since-filter, so `AshbyAdapter` uses the same client-side timestamp-filter pattern as `GreenhouseAdapter`, plus filters out `isListed: false` jobs (Ashby returns unlisted/draft postings too). SmartRecruiters' `v1/companies/{id}/postings` list endpoint returns `{offset, limit, totalFound, content}` with no description content and no confirmed date filter — confirmed by fetching the real API directly, since a WebFetch of SmartRecruiters' own "get-job-postings" docs page returned details for an unrelated, authenticated endpoint (`/feed/publications` with an `X-SmartToken` header) that doesn't match the public API at all. `SmartRecruitersAdapter` therefore uses Lever's seen-id-set incremental pattern, and makes a second, per-posting detail call (`.../postings/{id}`) for description content — but only for postings not already in the seen-id set, so a steady-state run with nothing new makes one list call and zero detail calls.

**Real bug found and fixed via live testing, retroactively affecting ticket 08 too**: the two timestamp-checkpoint adapters (`GreenhouseAdapter`, `AshbyAdapter`) always advanced `nextCheckpoint.cursor` to "now," even on a run with zero watched boards. `DiscoverySchedulerService.onModuleInit()` registers (and, per BullMQ's `upsertJobScheduler` behavior, appears to fire once immediately for) every adapter at boot — including ones with no `WatchedCompany` configured yet — which silently set each new source's checkpoint to boot time. Any board added *later* would then have every one of its existing (older) postings filtered out forever, since these adapters' "incremental" signal is purely a timestamp comparison. Caught by live-testing against Ashby's real (mostly 2024-dated) board — Greenhouse's ticket-08 live test happened not to expose it because Robinhood's board had jobs with recently-bumped `updated_at` values that coincidentally postdated the premature checkpoint. Fixed in both adapters: a run against zero boards now returns `nextCheckpoint: checkpoint` unchanged instead of advancing it. New regression test in each adapter's e2e file ("does not poison the checkpoint by running before any board is watched") exercises exactly this sequence. `LeverAdapter`/`SmartRecruitersAdapter` were never susceptible — their seen-id-set checkpoint is a no-op on an empty run by construction.

New e2e files: `ashby-adapter.e2e-spec.ts` (normalization incl. `isListed` filtering, checkpoint advancement across 3 runs, per-board failure resilience, checkpoint-poisoning regression), `smartrecruiters-adapter.e2e-spec.ts` (list+detail normalization, seen-id-set incremental behavior incl. asserting zero detail calls on a no-op run, per-posting detail-failure resilience, per-board list-failure resilience). Full e2e suite: 48/48 across 12 files, run twice to rule out flakiness. `tsc --noEmit` and `nest build` clean.

**Live-verified against both real public APIs** via the running Docker `api` container: SmartRecruiters' own board (1 real posting, correctly fetched/normalized/created). Ashby's own board — first confirming the checkpoint-poisoning bug live (a real 0-job pre-watch run followed by a real run that fetched 0 of the ~70+ genuinely-old real jobs on that board), then confirming the fix (same sequence, second run correctly fetched all 73 real jobs after resetting state and redeploying the fix).
