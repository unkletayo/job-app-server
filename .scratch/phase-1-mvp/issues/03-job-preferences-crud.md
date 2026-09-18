# 03 — Job Preferences CRUD

**What to build:** The user can configure and update their Job Preferences — target roles, seniority, locations, remote/hybrid preference, minimum salary, employment types, required/preferred technologies, excluded companies, excluded titles, keywords, negative keywords — through the API, and changes take effect immediately (no deploy/restart needed for later tickets to pick them up).

**Blocked by:** 01 — needs auth/ownership in place.

**Status:** ready-for-agent

- [ ] Read/update endpoint(s) exist for the full Job Preferences shape (PRD §57 fields, per `CONTEXT.md`'s Job Preferences definition)
- [ ] Preferences are scoped to the authenticated user, server-side enforced
- [ ] Updating preferences is immediately visible on the next read — no caching staleness that would block ticket 11 (Matching) from picking up a change
- [ ] e2e tests (Seam 1) cover reading defaults, updating each preference category, and a rejection case for cross-user access
