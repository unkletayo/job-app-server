# 09 — Ashby + SmartRecruiters adapters

**What to build:** Real automated discovery from the remaining two Sanctioned Sources — Ashby (`api.ashbyhq.com/posting-api`) and SmartRecruiters (Posting API) — both official, documented, unauthenticated-for-reads job-board APIs.

**Blocked by:** 07 — needs the scheduler/adapter harness to plug into.

**Status:** ready-for-agent

- [ ] `AshbyAdapter` implements `JobSourceAdapter` against the public Job Postings API
- [ ] `SmartRecruitersAdapter` implements `JobSourceAdapter` against the public Posting API
- [ ] Both adapters are isolated per [[0001-source-integration-policy]] and PRD §7
- [ ] Both respect the rate-limit/backoff and incremental-checkpointing behavior from ticket 07
- [ ] e2e/integration tests exercise each adapter against a recorded/fixture response (not live network calls in CI), proving correct normalization and checkpoint advancement
