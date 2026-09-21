# 12 — Dashboard API + minimal frontend

**What to build:** The single place the user reviews results — a dashboard showing discovered jobs and high-match jobs with their Match Scores, and a Job Posting detail view showing the score breakdown, Gaps, source, and application URL. This closes the Phase 1 loop: discovery → normalization → matching → candidate profile is now visible end to end, matching the vertical slice PRD's STEP 14 calls for.

**Blocked by:** 05 (Job Clusters to list), 11 (Match Scores to display).

**Status:** backend done; frontend not started (belongs in a separate repo per [[0006-separate-repos-for-frontend-and-backend]])

- [x] Dashboard API endpoint(s) return Job Clusters with their current Match Score, sortable/filterable by score
- [x] A "high-match" view surfaces Job Clusters above a threshold
- [x] A Job Posting detail endpoint/view returns the full Match Score breakdown (matched Requirements + Evidence, Gaps), the Job Cluster's source postings, and the application URL
- [ ] Minimal React frontend consumes these endpoints — job list view, high-match view, detail view — no styling/polish requirement, functional only
- [x] e2e tests (Seam 1) cover the dashboard and detail API responses; frontend is manually verified against a running stack (no new test seam introduced for the UI layer, per the spec's testing decisions)

## Comments

**Frontend is not part of this commit.** ADR 0006 puts the React frontend in its own repository, so it can't be built here. The fourth checkbox stays open until that repo exists; the API below is what it will consume.

**Backend** (`src/dashboard/`, new `DashboardModule` per the spec's "Dashboard/query module"): `GET /dashboard/jobs` returns each Job Posting (one per Job Cluster) with its `matchScore` attached, sorted by score descending, postings with no score last. `?minScore=N` (integer 0–100, validated — bad values get a 400) is the high-match view, so one parameterized endpoint serves both the list and high-match views instead of two near-duplicates. Hard-filtered postings are left out of the list entirely; they stay reachable individually via `GET /job-postings/:id` (ticket 11), which reports `excluded` and why. A posting with no extracted Requirements has `score: null` and is left out of any `minScore` filter, since there's nothing to measure against.

**No new detail endpoint** — ticket 11's `GET /job-postings/:id` already returns the score breakdown (reasons + gaps), `jobCluster.sourcePostings`, and `applicationUrl`, which is everything this ticket's third checkbox asks for.

**`MatchingService.scoreMany`** added (loads Job Preferences, Candidate Profile and Evidence once per request, not once per posting) because the dashboard scores hundreds of postings per call; `score` now shares the same context-loading path.

`test/dashboard.e2e-spec.ts`: score attached and sorted descending, hard-filtered postings excluded, `minScore` high-match view, null-score postings dropped by `minScore`, cross-user isolation, no-token rejection. All pass. Full suite: 68 tests across 15 files, `tsc --noEmit` and `nest build` clean.

**Live-verified** against the running Docker `api` container with 233 real postings (Robinhood, Ashby, SmartRecruiters, manual): correct ordering (confirmed descending across the whole list), `minScore=50` returned 68, and `minScore=abc`/`150` both returned 400. Temporary evidence added to the shared dev user for this check was removed afterward.

**Scoring weakness this exposed — since fixed** (commits 317d4d9 and 2d7be37; after-state at the end of this section). Original finding: with sample evidence loaded, 34 of the 38 postings scoring 100 rested on a single matched Requirement, and the top results were non-engineering roles (an Assistant General Counsel, a Cashiering Support Associate). Three causes, all in matching/extraction: (1) the score is `matched / total`, so a posting with one extracted Requirement scores 100 on one match; (2) the `experience` check compares a Requirement's "N years" against total years of *any* verified work experience, regardless of field, so 11 years in backend engineering "satisfies" 7+ years at a law firm; (3) Greenhouse `content` arrives as HTML-entity-encoded markup, so Requirements come out as `&lt;li&gt;…&lt;/li&gt;` and extraction finds little else. A dashboard that sorts by this score inherits all three. Fixed once approved:
- **Encoded HTML:** new `htmlToPlainText` (`src/job-postings/text-normalization.ts`) runs before Requirement extraction and the hard filters. The stored description is untouched.
- **Field-blind experience:** an `experience` Requirement now only counts Experience entries sharing a domain word with it; a requirement naming no field falls back to total experience at `medium` confidence.
- **Double counting and tiny denominators:** keyword Requirements that repeat a skill are skipped, and below 3 scorable Requirements the score is `null` with a `scoreNote` explaining why (reasons and gaps are still returned).

**After-state, same live data and same sample evidence** (Greenhouse postings reset and re-ingested so their Requirements were re-extracted): perfect scores went from 38 to 0; postings at 50+ from 68 to 6; 54 of 235 withheld with a note; the top results are now real engineering roles (Acme Backend Engineer 88, Senior Software Engineer Kubernetes Compute 75) instead of a General Counsel and a Cashiering Support Associate; no entity debris left in extracted text. Full suite 73/73 (`auth` needed `--testTimeout=40000` on the loaded machine). Temporary evidence removed afterward.

**Still open, not addressed here:**
- `JobPosting.description` is stored as delivered, so a frontend showing it will display entity-encoded HTML for Greenhouse postings; it needs the same decoding at display time (or a normalized copy).
- Requirements are only extracted when a posting is first created, so postings ingested before this fix keep stale Requirements until re-ingested — there is no re-extract endpoint.
- Extraction vocabulary false positives (`go`, `rest`, `express` match ordinary words) and responsibility matching by any shared word can still add noise.

**Environment note:** this was run on a machine with the Docker VM using 200%+ CPU (partly another project's containers). bcrypt at cost 12 took ~3s per hash, so `auth.e2e-spec.ts` exceeded Jest's 5s per-test limit and failed; it passes 4/4 with `--testTimeout=40000` and passed normally before the restart. A cascading 409 in the same suite was an orphaned request from a timed-out test registering after the next test's cleanup. No code was changed for this.
