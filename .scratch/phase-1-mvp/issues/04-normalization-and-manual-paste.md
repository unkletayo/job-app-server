# 04 — Normalization pipeline + manual-paste ingestion

**What to build:** The canonical Job Posting schema and the normalization pipeline that produces it, proven via the simplest possible entry point: `ManualPasteAdapter`. The user submits a job's raw text/fields (title, company, location, description, URL) — sourced from LinkedIn, Glassdoor, or anywhere else — and the system stores the untouched Source Posting alongside a normalized Job Posting. No network calls happen in this ticket; that's deliberate — it isolates the normalization logic from any source-integration risk.

**Blocked by:** 01 — needs auth/ownership in place.

**Status:** ready-for-agent

- [ ] `ManualPasteAdapter` implements the full `JobSourceAdapter` interface (PRD §7: `search`, `getJob`, `supportsApplication` → `false`, `getApplicationCapabilities`, `prepareApplication` stubbed/unused), accepting user-supplied fields directly rather than calling out to a network
- [ ] Submitting raw job text/fields produces both: an unmodified Source Posting record, and a Job Posting normalized into the canonical schema (PRD §9: company, title, description, location, remoteType, employmentType, salary, seniority, skills, requirements, preferredQualifications, education/experience requirements, applicationUrl, postedAt, deadline)
- [ ] Normalization never mutates or discards the raw Source Posting
- [ ] A posting containing prompt-injection-style text (e.g. "Ignore previous instructions...") in its description is stored and normalized as inert data — no behavior in the pipeline changes based on its content (PRD §23/§63)
- [ ] e2e tests (Seam 1) cover: paste → Source Posting preserved verbatim → Job Posting normalized correctly; a malicious-content fixture proving inert handling
