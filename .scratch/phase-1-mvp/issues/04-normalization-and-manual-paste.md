# 04 — Normalization pipeline + manual-paste ingestion

**What to build:** The canonical Job Posting schema and the normalization pipeline that produces it, proven via the simplest possible entry point: `ManualPasteAdapter`. The user submits a job's raw text/fields (title, company, location, description, URL) — sourced from LinkedIn, Glassdoor, or anywhere else — and the system stores the untouched Source Posting alongside a normalized Job Posting. No network calls happen in this ticket; that's deliberate — it isolates the normalization logic from any source-integration risk.

**Blocked by:** 01 — needs auth/ownership in place.

**Status:** done

- [x] `ManualPasteAdapter` implements the full `JobSourceAdapter` interface (PRD §7: `search`, `getJob`, `supportsApplication` → `false`, `getApplicationCapabilities`, `prepareApplication` stubbed/unused), accepting user-supplied fields directly rather than calling out to a network
- [x] Submitting raw job text/fields produces both: an unmodified Source Posting record, and a Job Posting normalized into the canonical schema (PRD §9: company, title, description, location, remoteType, employmentType, salary, seniority, skills, requirements, preferredQualifications, education/experience requirements, applicationUrl, postedAt, deadline) — salary flattened to salaryMin/salaryMax/salaryCurrency scalars, same data as PRD's nested shape
- [x] Normalization never mutates or discards the raw Source Posting
- [x] A posting containing prompt-injection-style text (e.g. "Ignore previous instructions...") in its description is stored and normalized as inert data — no behavior in the pipeline changes based on its content (PRD §23/§63)
- [x] e2e tests (Seam 1) cover: paste → Source Posting preserved verbatim → Job Posting normalized correctly; a malicious-content fixture proving inert handling

## Comments

Implemented in 24b77e8, reviewed via `/code-review` against 2d32642. Findings fixed in 31f8887:
- `SourceReference {source, sourceJobId}` replaces two loose strings that traveled together across three call sites.
- Schema comment corrected — was overclaiming exact PRD §9 fidelity when salary is flattened, not nested.
- `CONTEXT.md`'s Source Adapter definition sharpened: implemented by every source type, not just Sanctioned — the code was right, the glossary was stale.

**Kept as-is, reviewed and justified**: `search`/`supportsApplication`/`getApplicationCapabilities`/`prepareApplication` on `ManualPasteAdapter` are unexercised by any controller in this ticket (review flagged as Speculative Generality/Middle Man). Not removed — full `JobSourceAdapter` conformance is this ticket's own checklist item (only `prepareApplication` is called out as "stubbed/unused," `search` isn't), and ticket 07's scheduler harness + tickets 08–10's real adapters depend on this exact interface already existing. No new test added for them either — per `spec.md`'s testing decisions, Seam 2 (`JobSourceAdapter`, via fakes) starts in ticket 07, not here.
