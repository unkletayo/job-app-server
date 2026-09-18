# Deterministic-first matching and deduplication for Phase 1

The PRD's Matching Engine (§31) specifies a hybrid of hard filters, structured matching, semantic (embedding) matching, and LLM reasoning. Phase 1 implements only the hard-filter + structured-matching layers — no embeddings, no LLM call in the scoring path. Job Cluster deduplication (§10) is likewise signal-based (company/title/location/URL) with no semantic similarity step.

This satisfies the PRD's own §85 acceptance criteria for Matching (explainable, evidence-traceable, gaps identified) without needing an LLM provider or vector store wired up before the core discovery→normalize→match slice is proven. Semantic and LLM-reasoned scoring are additive layers for a later phase, not a rewrite of this one.
