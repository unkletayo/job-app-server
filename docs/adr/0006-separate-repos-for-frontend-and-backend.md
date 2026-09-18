# Separate repositories for frontend and backend

This repository is the backend (NestJS API + worker) only. The React frontend (ticket 12) gets its own separate git repository rather than living alongside the backend in a monorepo. [[0002-tech-stack]] fixes the technology choices; this ADR fixes the repo boundary those choices live in.

A reader who expects a monorepo (common for a solo full-stack TypeScript project, and how this repo was briefly scaffolded before being corrected) should not "fix" this by merging the frontend back in — it was a deliberate choice, not an oversight.
