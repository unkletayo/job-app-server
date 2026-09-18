# 08 — Greenhouse + Lever adapters

**What to build:** Real automated discovery from two Sanctioned Sources — Greenhouse (`boards-api.greenhouse.io`) and Lever (`api.lever.co`) — both unauthenticated, publicly documented JSON job-board APIs, registered with the scheduler from ticket 07.

**Blocked by:** 07 — needs the scheduler/adapter harness to plug into.

**Status:** ready-for-agent

- [ ] `GreenhouseAdapter` implements `JobSourceAdapter`, calling the public Job Board API, normalizing results into Job Postings via the ticket 04 pipeline
- [ ] `LeverAdapter` implements `JobSourceAdapter` the same way against the public Postings API
- [ ] Both adapters are isolated per [[0001-source-integration-policy]] and PRD §7 — a failure or format change in one cannot break the other
- [ ] Both respect the rate-limit/backoff and incremental-checkpointing behavior from ticket 07
- [ ] e2e/integration tests exercise each adapter against a recorded/fixture response (not live network calls in CI), proving correct normalization and checkpoint advancement
