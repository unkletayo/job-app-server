# 05 — Job Cluster deduplication

**What to build:** Postings that represent the same real-world job get folded into one Job Cluster instead of showing up as separate Job Postings, using the deterministic signals decided in [[0003-deterministic-first-matching]] — company, title, location, canonical application URL, external job ID. No description-similarity or embedding step.

**Blocked by:** 04 — needs normalized Job Postings to cluster.

**Status:** done

- [x] Two Source Postings (e.g. two manual pastes) matching on the dedup signals are assembled into one Job Cluster with one canonical Job Posting
- [x] A Job Cluster exposes which Source Postings make it up (per `CONTEXT.md`'s Job Cluster definition — the user can tell where a Job Posting actually came from)
- [x] Postings that don't match the dedup signals remain separate clusters — no over-merging
- [x] e2e tests (Seam 1) cover: two matching postings → one cluster; two non-matching postings → two clusters; cluster detail exposes its source postings

## Comments

Implemented in 61d6614, reviewed via `/code-review` against 84ee079. Findings fixed in c2ff460:
- Added the external-job-id dedup signal — ADR 0003 names three signal families (company+title+location, canonical URL, external job id); only the first two were implemented initially.
- Closed a real race: match-check + creates now run in one serializable transaction with bounded retry, matching `auth.service.ts`'s existing pattern — without this, two near-simultaneous ingests of the same new job could each miss the match and create separate clusters.
- Dropped an unused `IngestResult.merged` field.

Restructured ticket 04's schema as a necessary consequence: `JobPosting` was 1:1 with `SourcePosting`; now `JobCluster` sits between them (1:many with `SourcePosting`, 1:1 with the canonical `JobPosting`). `JobPosting` no longer carries `source`/`sourceJobId` — a cluster can span sources, so a single pair would be misleading; that provenance now lives per-`SourcePosting`. Fixed ticket 04's e2e test to match.

**Not testable via Seam 1 yet**: the external-job-id signal, since manual paste mints a fresh `sourceJobId` every time by design — same reasoning as ticket 04's unexercised `JobSourceAdapter` methods. Becomes testable once a real adapter (ticket 08+) provides stable external ids across re-fetches.
