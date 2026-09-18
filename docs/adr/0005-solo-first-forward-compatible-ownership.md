# Solo-first scope with forward-compatible ownership columns

This is a single-user tool for now — no multi-tenant auth flows, no permissions dashboard UI, no invite/role system in Phase 1. But every user-owned table (`candidate_profiles`, `job_preferences`, etc.) still carries a `user_id` column and a single local account (email+password, JWT) from day one, per PRD §67's ownership-boundary requirement.

The reason to pay this small cost now: the user explicitly wants this extendable to multi-user later, and retrofitting ownership columns onto an already-populated schema is far more disruptive than including them from the start. A reader seeing `user_id` on every table in a single-user app should not "simplify" it away — that column is there on purpose.
