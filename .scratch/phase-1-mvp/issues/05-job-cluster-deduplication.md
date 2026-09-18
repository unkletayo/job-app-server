# 05 — Job Cluster deduplication

**What to build:** Postings that represent the same real-world job get folded into one Job Cluster instead of showing up as separate Job Postings, using the deterministic signals decided in [[0003-deterministic-first-matching]] — company, title, location, canonical application URL, external job ID. No description-similarity or embedding step.

**Blocked by:** 04 — needs normalized Job Postings to cluster.

**Status:** ready-for-agent

- [ ] Two Source Postings (e.g. two manual pastes) matching on the dedup signals are assembled into one Job Cluster with one canonical Job Posting
- [ ] A Job Cluster exposes which Source Postings make it up (per `CONTEXT.md`'s Job Cluster definition — the user can tell where a Job Posting actually came from)
- [ ] Postings that don't match the dedup signals remain separate clusters — no over-merging
- [ ] e2e tests (Seam 1) cover: two matching postings → one cluster; two non-matching postings → two clusters; cluster detail exposes its source postings
