# 03 — Job Preferences CRUD

**What to build:** The user can configure and update their Job Preferences — target roles, seniority, locations, remote/hybrid preference, minimum salary, employment types, required/preferred technologies, excluded companies, excluded titles, keywords, negative keywords — through the API, and changes take effect immediately (no deploy/restart needed for later tickets to pick them up).

**Blocked by:** 01 — needs auth/ownership in place.

**Status:** done

- [x] Read/update endpoint(s) exist for the full Job Preferences shape (PRD §57 fields, per `CONTEXT.md`'s Job Preferences definition)
- [x] Preferences are scoped to the authenticated user, server-side enforced
- [x] Updating preferences is immediately visible on the next read — no caching staleness that would block ticket 11 (Matching) from picking up a change
- [x] e2e tests (Seam 1) cover reading defaults, updating each preference category, and a rejection case for cross-user access — this resource has no `:id` in its URL, so "rejection" manifests as proven data isolation (no request shape exists for an intruder to even name another user's row), not a 401/403 path; see the test file's comment

## Comments

Implemented in eedeafa, reviewed via `/code-review` against 85b395b. Findings fixed in b0f72f0:
- `JobPreferencesService.update` renamed to `upsert` (it creates too — matches `CandidateProfileService`'s honest naming).
- Documented why this endpoint is `PATCH` while `CandidateProfileController.upsert` is `PUT` (genuine partial merge here vs. full-replace shape there).
- Clarified in the test file why the "cross-user rejection" test is a data-isolation test, not a 401/403 test — this resource has no `:id` param, so there's no cross-user access surface to reject.

No DELETE endpoint — ticket text says "Read/update endpoint(s)" only, unlike ticket 02's explicit "Create/read/update/delete." Deliberate scope, confirmed against the ticket wording, not a gap.
