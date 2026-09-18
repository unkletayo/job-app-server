Status: ready-for-agent

# Phase 1 MVP — Job Discovery, Candidate Profile, Matching

## Problem Statement

Job seekers manually re-check multiple job boards, re-read the same postings across sources, and eyeball-match their own background against requirements — repetitive work with no memory between sessions and no explainable signal for why a job is or isn't a fit.

## Solution

A personal job-search dashboard that discovers new postings from a fixed set of sources on a schedule, folds duplicate postings of the same job into one Job Posting, scores each Job Posting against the user's own Candidate Profile and Job Preferences with visible, explainable reasoning (matched Requirements and Gaps — never an unexplained number), and surfaces the results in a single dashboard. No application material generation, no autofill, no submission — this slice proves discovery → normalization → matching → candidate profile end to end before any of that is built.

## User Stories

1. As the user, I want to create a single local account (email + password), so that the app is mine and nothing else can read or write my data.
2. As the user, I want to log in and stay logged in via a JWT session, so that I don't re-authenticate on every request.
3. As the user, I want to build my Candidate Profile through manual forms (personal info, contact, location, work authorization, professional summary, experience entries, education entries, certifications, skills, projects, achievements, links), so that Matching has real Candidate Evidence to work from.
4. As the user, I want every fact I enter into my Candidate Profile to carry provenance (`source: user_profile`, `verified: true`), so that the system can later distinguish my verified facts from anything AI-suggested.
5. As the user, I want to edit or delete any Candidate Profile entry, so that my profile stays accurate as my background changes.
6. As the user, I want to configure my Job Preferences (target roles, seniority, locations, remote/hybrid preference, minimum salary, employment types, required technologies, preferred technologies, excluded companies, excluded titles, keywords, negative keywords), so that Job Discovery and Matching both respect what I actually want.
7. As the user, I want to update my Job Preferences at any time, so that changes take effect on the next discovery/match cycle without a deploy or restart.
8. As the user, I want the system to automatically poll Greenhouse, Lever, Ashby, and SmartRecruiters on a schedule, so that I see new postings without checking each site myself.
9. As the user, I want each Sanctioned Source's discovery to run through an isolated Source Adapter, so that one source's outage or format change can't break another source's discovery.
10. As the user, I want discovery requests to respect each source's rate limits with backoff, so that I don't get my access blocked.
11. As the user, I want discovery to use incremental fetching (only new/changed postings since the last successful run), so that repeated polling doesn't hammer the source or waste time reprocessing what I've already seen.
12. As the user, I want to paste a job's raw text/fields (title, company, location, description, URL) from LinkedIn or Glassdoor, so that those postings enter my pipeline exactly like any Sanctioned Source posting, without the system ever making a request to linkedin.com or glassdoor.com.
13. As the user, I want to add a custom/unlisted job URL, so that the system attempts an automated fetch of that specific page and falls back to asking me to paste the content if the fetch fails or is blocked.
14. As the user, I want every Source Posting's raw, as-fetched data preserved unmodified, so that normalization is never a lossy one-way transform I can't audit or debug.
15. As the user, I want every fetched or pasted posting normalized into one canonical Job Posting schema (company, title, description, location, remote type, employment type, salary range, seniority, skills, requirements, preferred qualifications, education/experience requirements, application URL, posted date, deadline), so that postings from different sources are comparable and displayable the same way.
16. As the user, I want postings that represent the same real job (matched on company, title, location, canonical application URL, external job ID) folded into one Job Cluster, so that I never see the same job listed five times.
17. As the user, I want to see which Source Postings make up a Job Cluster, so that I can tell where a Job Posting actually came from.
18. As the user, I want Requirements auto-extracted from each Job Posting's description (required skills, preferred skills, experience requirements, education requirements, certifications, responsibilities, keywords), so that Matching has something concrete to check my profile against.
19. As the user, I want each Job Posting scored deterministically against my Candidate Profile and Job Preferences (hard filters + structured Requirement/Evidence overlap — no embeddings, no LLM call), so that I get a working matching signal without needing an LLM provider wired up for this phase.
20. As the user, I want a Job Posting excluded outright (not just down-scored) when it fails a hard filter (blocked company, disallowed employment type, excluded title/keyword), so that Job Preferences I've explicitly set as exclusions are actually enforced.
21. As the user, I want every Match Score accompanied by the specific Requirements that matched (with the Candidate Evidence that satisfied them) and the Gaps that didn't, so that I understand why a job scored the way it did rather than trusting an opaque number.
22. As the user, I want a single dashboard showing jobs discovered, high-match jobs, and per-job Match Score with its reasons, so that I have one place to review results instead of checking four sources and my own notes.
23. As the user, I want to open a Job Posting's detail view and see its Match Score breakdown, Gaps, source, and application URL, so that I can decide whether to pursue it myself (this slice does nothing beyond showing me the link).
24. As the user, I want a discovery/matching run's outcome (jobs fetched, jobs deduplicated into existing clusters, new clusters created, scoring failures) recorded, so that I can tell whether a scheduled run actually worked.
25. As the user, I want failed or partial discovery runs (a source down, a malformed posting) to not crash the whole cycle, so that one bad source or posting doesn't block discovery for the others.
26. As the user, I want job description content always treated as inert data during normalization and extraction, so that a malicious or prompt-injection-style string in a posting can't change what the system does.
27. As the developer, I want the Source Adapter interface (`search`, `getJob`, `supportsApplication`, `getApplicationCapabilities`, `prepareApplication`) implemented now even though `prepareApplication`/submission isn't used until a later phase, so that adding real application support later doesn't require reshaping the adapter contract.
28. As the developer, I want an LLM Gateway abstraction present in the codebase (even if only Claude is wired up and nothing calls it yet in this phase), so that Phase 2's resume/cover-letter/matching-reasoning work has a seam to build against instead of retrofitting one.

## Implementation Decisions

- **Modules**: Auth module (single local user, JWT); Candidate Profile module; Job Preferences module; Job Discovery module (scheduler + Source Adapters: `GreenhouseAdapter`, `LeverAdapter`, `AshbyAdapter`, `SmartRecruitersAdapter`, `ManualPasteAdapter`, `GenericFetchAdapter`); Job Normalization module; Job Deduplication module (Job Cluster assembly); Matching module (hard filters + structured scoring, per [[0003-deterministic-first-matching]]); Dashboard/query module (read API for the frontend).
- **`JobSourceAdapter` interface**: every source — including `ManualPasteAdapter` and `GenericFetchAdapter` — implements the same interface from PRD §7 (`search`, `getJob`, `supportsApplication`, `getApplicationCapabilities`, `prepareApplication`). `ManualPasteAdapter.search`/`getJob` accept user-supplied fields directly rather than calling out to a network; `supportsApplication` returns `false` for all adapters in this phase. This keeps the core discovery/normalization pipeline identical regardless of how a Source Posting entered the system.
- **Source integration policy**: enforced per [[0001-source-integration-policy]] — `GenericFetchAdapter` is the only adapter allowed to make an outbound HTTP request to a source not on the Sanctioned Source list, and it never targets `linkedin.com`/`glassdoor.com` (hard-coded domain denylist at the adapter boundary, not just a convention). LinkedIn/Glassdoor postings only ever enter through `ManualPasteAdapter`.
- **Scheduling**: discovery runs on a periodic schedule (default every 6 hours, per PRD §8) via a Redis-backed job queue (BullMQ, matches [[0002-tech-stack]]'s Node/NestJS stack). Each Sanctioned Source tracks `last_successful_run`, `last_cursor`/pagination checkpoint, and `last_seen_job` for incremental fetching.
- **Job Cluster assembly**: dedup signals are company + title + location + canonical application URL + external job ID, per [[0003-deterministic-first-matching]] — no description-similarity or embedding step in this phase.
- **Matching**: hard filters (work authorization, employment type, excluded company/title/keyword) run first and exclude outright; structured scoring (Requirement/Evidence overlap) produces the Match Score for whatever passes the filters. No semantic or LLM-reasoned scoring in this phase, per [[0003-deterministic-first-matching]].
- **Auth**: single local `users` row, bcrypt-hashed password, JWT session — every domain table carries `user_id` from day one per [[0005-solo-first-forward-compatible-ownership]], enforced server-side on every query.
- **LLM Gateway**: present as an interface/module with a Claude-backed implementation per [[0004-llm-gateway-abstraction]], but nothing in this phase's request path calls it — it's scaffolding for Phase 2, not active in Phase 1 behavior.
- **Secrets**: source credentials (none needed for the four Sanctioned Sources, which are unauthenticated reads) and the Anthropic API key (unused this phase but configured) live in `.env`, never logged, never sent in any LLM prompt.
- **Deployment**: Docker Compose services — API (NestJS), worker (BullMQ processor), Postgres, Redis — per [[0002-tech-stack]].
- **Schema note**: `Job Posting`/`Source Posting`/`Job Cluster`/`Candidate Evidence`/`Job Preferences` fields follow the canonical shapes in PRD §9, §11, §57 and `CONTEXT.md` — not re-specified here since those are already the source of truth.

## Testing Decisions

- Good tests here assert external, observable behavior — API responses and database state reachable through the same two seams below — never internal call counts or private method behavior.
- **Seam 1 (primary)** — HTTP API boundary: e2e tests (supertest) against NestJS controllers, backed by a real Postgres test database (not mocked). Covers candidate profile CRUD, job preferences CRUD, manual-paste ingestion, dashboard/job-listing queries, and match-result retrieval — essentially all of Phase 1's request-driven surface.
- **Seam 2 (necessary second)** — `JobSourceAdapter` interface: fake adapters implementing the same interface stand in for `GreenhouseAdapter`/`LeverAdapter`/`AshbyAdapter`/`SmartRecruitersAdapter` in discovery-engine tests, since scheduled discovery is triggered by the queue, not an HTTP request, and tests must never call the real external APIs. Assertions still land on real Postgres state (jobs normalized, deduplicated, scored) reached by querying through Seam 1 afterward where possible.
- No prior art in the codebase yet (greenfield) — these two seams are the pattern going forward; prefer them over introducing new ones as Phase 2 lands.
- Dedicated tests for: hard-filter exclusion correctness, Match Score/Gap explainability (right Requirements/Evidence cited), Job Cluster assembly (same job from two sources → one cluster), incremental-fetch checkpointing (second run doesn't reprocess), the LinkedIn/Glassdoor domain denylist (`GenericFetchAdapter` must refuse those two domains even if asked), and malicious-content handling in normalization (a posting containing injection-style text is treated as inert data, per PRD §23/§63).

## Out of Scope

- Resume generation, cover letter generation, application-question answering (Phase 2).
- Application preparation, autofill, submission, browser automation, Playwright usage (Phase 3+).
- Semantic/embedding matching and LLM-reasoned scoring (deferred layer on top of this phase's deterministic core).
- Resume-file import/parsing to bootstrap the Candidate Profile — manual forms only this phase.
- Multi-user auth flows, roles, invites, permissions dashboard UI (schema is forward-compatible per [[0005-solo-first-forward-compatible-ownership]], but the UI/flows aren't built yet).
- Email integration, Slack/Telegram notifications, interview prep, outcome learning.
- Any source beyond Greenhouse/Lever/Ashby/SmartRecruiters (Sanctioned), LinkedIn/Glassdoor (Manual-Assist), and generic custom URLs (fetch-with-fallback).

## Further Notes

- This spec covers PRD Phase 1 exactly as scoped in the grilling session — profile, preferences, discovery, normalization, dedup, matching, dashboard, nothing more.
- The `JobSourceAdapter` interface and LLM Gateway are built now even though parts of their surface (`prepareApplication`, LLM calls) go unused this phase, specifically so Phase 2/3 don't require reshaping these seams — see user stories 27–28.
- Domain vocabulary throughout this spec (Job Posting, Source Posting, Job Cluster, Sanctioned Source, Manual-Assist Source, Candidate Evidence, Match Score, Gap, Requirement) follows `CONTEXT.md` exactly — no synonyms introduced.
