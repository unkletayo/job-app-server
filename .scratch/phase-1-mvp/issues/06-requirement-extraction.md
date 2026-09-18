# 06 — Requirement extraction

**What to build:** Given a normalized Job Posting, extract structured Requirements from its description — required skills, preferred skills, experience requirements, education requirements, certifications, responsibilities, keywords — using deterministic, rule-based extraction. No LLM call in this ticket: the spec is explicit that nothing in Phase 1's request path calls the LLM Gateway.

**Blocked by:** 04 — needs a normalized Job Posting to extract from.

**Status:** ready-for-agent

- [ ] Requirement extraction runs against a Job Posting's description and produces structured Requirement records (PRD §13 categories)
- [ ] Extraction is deterministic/rule-based (keyword/pattern matching against known skill/qualification vocabularies) — no LLM Gateway call
- [ ] A posting containing prompt-injection-style text in its description does not change extraction behavior — the content is only ever mined for Requirement-shaped data, never treated as instructions (PRD §23/§63, same invariant as ticket 04)
- [ ] e2e tests (Seam 1) cover extraction against a realistic job description fixture and against the malicious-content fixture, asserting both produce sane Requirement lists with no injected behavior
