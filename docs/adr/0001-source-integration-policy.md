# Source integration policy: sanctioned APIs vs. paste-only

Job discovery only makes automated requests to sources with an official, documented public read API (Greenhouse, Lever, Ashby, SmartRecruiters). LinkedIn and Glassdoor have no such API and documented anti-scraping enforcement history, so the system never makes a server-side request to either domain — the user pastes the job text/fields manually instead. Any other, unlisted source may be auto-fetched with a fallback to manual paste if the fetch fails or is blocked.

This is deliberate, not a gap: a future contributor adding "just fetch the LinkedIn URL like we do for others" would be reintroducing the exact bypass this policy exists to prevent (see PRD §37, §86 — "do not build a bypass," "do not assume scraping is permitted").

## Considered Options

- Scrape LinkedIn/Glassdoor like any other source — rejected: violates documented ToS enforcement, no official API exists.
- Blanket "try fetch, fall back to paste" for every source including LinkedIn/Glassdoor — rejected: a successful fetch against an explicitly anti-scraping domain isn't a fallback, it's the forbidden bypass.
