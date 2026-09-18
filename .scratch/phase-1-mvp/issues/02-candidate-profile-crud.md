# 02 — Candidate Profile CRUD

**What to build:** The user can build and maintain their Candidate Profile — personal info, contact, location, work authorization, professional summary, experience entries, education entries, certifications, skills, projects, achievements, links — through the API, with every fact carrying provenance from the moment it's created.

**Blocked by:** 01 — needs auth/ownership in place.

**Status:** done

- [x] Create/read/update/delete endpoints exist for each Candidate Profile section (experience, education, certifications, skills, projects, achievements, links, plus the flat personal/contact/location/work-authorization/summary fields) — flat profile got a DELETE endpoint added in review-fix pass, was GET/PUT only initially
- [x] Every entry is created with provenance — `source: user_profile`, `verified: true`, `lastUpdated` timestamp — per `CONTEXT.md`'s Candidate Evidence definition
- [x] All endpoints are scoped to the authenticated user's own profile (ownership enforced server-side, not just by JWT identity in isolation — a request can never read/write another `user_id`'s rows, relevant once multi-user lands) — mutating queries (`updateMany`/`deleteMany`) are scoped by `{id, userId}` atomically, not just a preceding check
- [x] e2e tests (Seam 1) cover create, edit, delete for at least one entry per profile section, and a rejection case (attempting to access a profile entry that doesn't belong to the authenticated user)

## Comments

Implemented in 57052c3, reviewed via `/code-review` against 95ce62e. Findings fixed in f03ece0:
- Ownership enforcement tightened to be atomic (`updateMany`/`deleteMany` with `{id, userId}` in the query itself, not a separate pre-check).
- Flat profile got its missing DELETE endpoint.
- `ResponseEnvelopeFilter` now logs unexpected errors instead of swallowing them silently — found this gap while debugging the item below.

**Note for future readers**: a generic `EntryCrudController` mixin was tried to address the reviewer's controller-duplication finding (~280 near-identical lines across the 7 entry controllers) and reverted. It's a real duplication, but in this NestJS/ts-jest setup, `@Body() dto: TCreateDto` on a shared generic route handler has its type erased to `Object` at compile time — `ValidationPipe` has no DTO class to validate/transform against, so every write endpoint would silently accept unvalidated bodies (caught via a raw date string reaching Prisma instead of a transformed `Date`). Don't re-attempt this exact pattern without solving that first — e.g. per-section route method overrides for `create`/`update` only, keeping the mixin for the DTO-free routes.
