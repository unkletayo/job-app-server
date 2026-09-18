# 11 — Matching engine

**What to build:** Deterministic Match Score computation for a Job Posting against the user's Candidate Profile and Job Preferences — hard filters that exclude outright, then structured Requirement/Evidence scoring, per [[0003-deterministic-first-matching]]. No embeddings, no LLM call. Every Match Score is returned with the Requirements that matched (and the Evidence that satisfied them) plus the Gaps that didn't — never an unexplained number.

**Blocked by:** 02 (Candidate Profile/Evidence), 03 (Job Preferences), 06 (Requirements to match against). Does not depend on live discovery (07–10) — can be exercised against manually-pasted Job Postings alone.

**Status:** ready-for-agent

- [ ] Hard filters (work authorization, employment type, excluded company/title/keyword from Job Preferences) run first; a Job Posting failing any hard filter is excluded outright, not merely down-scored
- [ ] Job Postings passing hard filters get a structured Match Score computed from Requirement/Evidence overlap
- [ ] The Match Score response includes: matched Requirements with their supporting Candidate Evidence, and Gaps (Requirements with no matching Evidence)
- [ ] Only verified Candidate Evidence (`verified: true`) contributes to a match — per `CONTEXT.md`'s Candidate Evidence definition
- [ ] e2e tests (Seam 1) cover: a hard-filter exclusion case, a high-match case with cited evidence, and a case with explicit Gaps reported
