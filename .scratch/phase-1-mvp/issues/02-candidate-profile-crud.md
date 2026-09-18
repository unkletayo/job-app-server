# 02 — Candidate Profile CRUD

**What to build:** The user can build and maintain their Candidate Profile — personal info, contact, location, work authorization, professional summary, experience entries, education entries, certifications, skills, projects, achievements, links — through the API, with every fact carrying provenance from the moment it's created.

**Blocked by:** 01 — needs auth/ownership in place.

**Status:** ready-for-agent

- [ ] Create/read/update/delete endpoints exist for each Candidate Profile section (experience, education, certifications, skills, projects, achievements, links, plus the flat personal/contact/location/work-authorization/summary fields)
- [ ] Every entry is created with provenance — `source: user_profile`, `verified: true`, `lastUpdated` timestamp — per `CONTEXT.md`'s Candidate Evidence definition
- [ ] All endpoints are scoped to the authenticated user's own profile (ownership enforced server-side, not just by JWT identity in isolation — a request can never read/write another `user_id`'s rows, relevant once multi-user lands)
- [ ] e2e tests (Seam 1) cover create, edit, delete for at least one entry per profile section, and a rejection case (attempting to access a profile entry that doesn't belong to the authenticated user)
