# 12 — Dashboard API + minimal frontend

**What to build:** The single place the user reviews results — a dashboard showing discovered jobs and high-match jobs with their Match Scores, and a Job Posting detail view showing the score breakdown, Gaps, source, and application URL. This closes the Phase 1 loop: discovery → normalization → matching → candidate profile is now visible end to end, matching the vertical slice PRD's STEP 14 calls for.

**Blocked by:** 05 (Job Clusters to list), 11 (Match Scores to display).

**Status:** ready-for-agent

- [ ] Dashboard API endpoint(s) return Job Clusters with their current Match Score, sortable/filterable by score
- [ ] A "high-match" view surfaces Job Clusters above a threshold
- [ ] A Job Posting detail endpoint/view returns the full Match Score breakdown (matched Requirements + Evidence, Gaps), the Job Cluster's source postings, and the application URL
- [ ] Minimal React frontend consumes these endpoints — job list view, high-match view, detail view — no styling/polish requirement, functional only
- [ ] e2e tests (Seam 1) cover the dashboard and detail API responses; frontend is manually verified against a running stack (no new test seam introduced for the UI layer, per the spec's testing decisions)
