# 06 — Requirement extraction

**What to build:** Given a normalized Job Posting, extract structured Requirements from its description — required skills, preferred skills, experience requirements, education requirements, certifications, responsibilities, keywords — using deterministic, rule-based extraction. No LLM call in this ticket: the spec is explicit that nothing in Phase 1's request path calls the LLM Gateway.

**Blocked by:** 04 — needs a normalized Job Posting to extract from.

**Status:** done

- [x] Requirement extraction runs against a Job Posting's description and produces structured Requirement records (PRD §13 categories)
- [x] Extraction is deterministic/rule-based (keyword/pattern matching against known skill/qualification vocabularies) — no LLM Gateway call
- [x] A posting containing prompt-injection-style text in its description does not change extraction behavior — the content is only ever mined for Requirement-shaped data, never treated as instructions (PRD §23/§63, same invariant as ticket 04)
- [x] e2e tests (Seam 1) cover extraction against a realistic job description fixture and against the malicious-content fixture, asserting both produce sane Requirement lists with no injected behavior

## Comments

New `Requirement` model (`prisma/schema.prisma`), one row per extracted requirement, related to `JobPosting.extractedRequirements` (named to avoid colliding with the pre-existing `JobPosting.requirements: string[]` adapter field, which is a separate, currently-unpopulated field from ticket 04). Migration `20260918235643_add_requirement_extraction`.

`RequirementExtractionService` (`src/job-postings/requirement-extraction.service.ts`) is a pure, dependency-free rule-based extractor: splits the description into lines/sentences, tracks section headings (Requirements/Preferred Qualifications/Responsibilities) to bias skill matches toward `required_skill` vs `preferred_skill`, and independently pattern-matches years-of-experience phrasing, a degree vocabulary (`education`), a certification vocabulary (`certification`), a skill/tech vocabulary (`required_skill`/`preferred_skill` + `keyword`), and responsibility-verb-led lines (`responsibility`). No network/DB access, no LLM Gateway call anywhere in the path — matches 0003/0004's no-LLM-in-Phase-1-request-path stance.

Wired into `JobNormalizationService.ingestOnce`: extraction runs only when a **new** Job Posting is created, not when an incoming Source Posting merges into an existing cluster — a merge reuses the existing canonical Job Posting's description unchanged, so re-extracting would just duplicate rows. Runs inside the same serializable transaction as the Job Posting create.

Malicious-content invariant holds by construction, not by a special case: the extractor only ever tests description text against fixed vocab/regex patterns and never branches on it meaning anything — injection-style text just fails to match any pattern and produces an empty (still well-formed) Requirement list, exactly like any other unmatched text would.

`JobPostingsService.findOne` now includes `extractedRequirements` so Seam 1 can observe them; no new endpoint needed. New e2e file `test/requirement-extraction.e2e-spec.ts` covers a realistic multi-section fixture (asserts all 7 categories populated correctly) and the malicious-content fixture (asserts an empty, well-formed list). Full e2e suite (29 tests) and `tsc --noEmit` pass; project has no eslint config despite the `lint` script existing (no `eslint.config.*`, no `eslint` devDependency) — noted rather than silently skipped, consistent with prior tickets. Verified live end-to-end against the running Docker `api` container (rebuilt with `--force-recreate -V` to bust the stale anonymous `node_modules` volume) with real registration/login/manual-paste/detail calls against real Postgres.
