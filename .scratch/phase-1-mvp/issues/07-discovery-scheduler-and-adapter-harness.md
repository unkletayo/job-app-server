# 07 — Discovery scheduler + adapter harness

**What to build:** The scheduled-discovery machinery that every real Source Adapter (tickets 08–10) will plug into: periodic scheduling via a Redis-backed queue (BullMQ, per [[0002-tech-stack]]), incremental-fetch checkpointing, per-source rate-limit/backoff, run-outcome recording, and partial-failure isolation. Proven in this ticket using a fake adapter implementing `JobSourceAdapter` — no real external network calls yet. This is Seam 2 (fake adapters standing in for real ones) coming into existence.

**Blocked by:** 05 — discovery of multiple postings needs Job Cluster dedup already in place to be meaningful.

**Status:** ready-for-agent

- [ ] A source registered with the scheduler runs on a periodic schedule (default every 6 hours, configurable)
- [ ] Each source tracks `last_successful_run`, `last_cursor`/pagination checkpoint, `last_seen_job` — a second run against a fake adapter does not reprocess postings already seen
- [ ] Rate limiting (throttling + exponential backoff + jitter) is applied per source
- [ ] Each run produces a recorded outcome: jobs fetched, jobs merged into existing clusters, new clusters created, scoring/extraction failures — queryable after the fact
- [ ] A failure in one source's adapter (simulated via the fake adapter) does not stop other sources' discovery in the same cycle, and does not crash the worker
- [ ] Seam 2 tests: a fake `JobSourceAdapter` is registered, discovery runs, normalized/deduped Job Postings land in Postgres (verified via Seam 1 queries), a second run proves incremental fetching, and a fake-adapter failure proves isolation
