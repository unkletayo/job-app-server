# Tech stack: NestJS/React/TypeScript over PRD's Java/Spring default

The source PRD (`prompts/prd.md`) recommends Java/Spring Boot + React for a production version of this platform. We're building NestJS + React/TypeScript instead, with Postgres, Redis, and Playwright kept from the PRD's recommendation. One language end-to-end suits a solo-built project better and doesn't compromise any of the PRD's architectural requirements (adapter isolation, policy engine, audit layer all translate directly).

Deployment is local-only via Docker Compose for now — no cloud infrastructure, no managed secrets manager. Secrets live in `.env` / OS keychain instead.
