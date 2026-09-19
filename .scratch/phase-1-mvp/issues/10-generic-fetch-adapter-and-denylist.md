# 10 — GenericFetchAdapter + LinkedIn/Glassdoor denylist

**What to build:** Support for custom/unlisted job URLs — the system attempts an automated fetch of the specific page, falling back to asking the user to paste the content if the fetch fails or is blocked (robots.txt-respecting). This ticket also hard-codes the domain denylist that makes [[0001-source-integration-policy]] an enforced invariant rather than a convention: `GenericFetchAdapter` must refuse to ever fetch `linkedin.com` or `glassdoor.com`, full stop, even if asked.

**Blocked by:** 07 — needs the scheduler/adapter harness to plug into (though this adapter is typically invoked on-demand from a user-submitted URL, not purely on a schedule).

**Status:** done

- [x] `GenericFetchAdapter` implements `JobSourceAdapter`; given an arbitrary job URL, attempts a fetch, checks robots.txt, and on success normalizes the result via the ticket 04 pipeline
- [x] On fetch failure or robots.txt disallow, the adapter returns a clear "needs manual paste" state rather than silently failing or retrying indefinitely
- [x] A hard-coded domain denylist rejects any fetch attempt targeting `linkedin.com` or `glassdoor.com` (or their subdomains) before any network request is made — this check cannot be bypassed by adapter configuration
- [x] e2e/integration tests cover: successful generic fetch, fetch failure falling back to manual-paste state, and — critically — an attempt to fetch a `linkedin.com`/`glassdoor.com` URL through this adapter is refused with no outbound request made (assert via network-call spy/mock, not just response code)

## Comments

`needs_manual_paste` is modeled as a normal, successful discriminated-union return value (`FetchUrlResult`), not a thrown exception — it's an expected, first-class outcome (denylisted domain, robots.txt disallow, and fetch failure all funnel into it identically), and `ResponseEnvelopeFilter` unconditionally marks any thrown-exception response `requestSuccessful: false` plus error-logs anything outside its five recognized exception classes, which would misrepresent this case. `GenericFetchAdapter` still implements the full `JobSourceAdapter` interface for consistency with `ManualPasteAdapter` and ticket wording — `getJob`/`search` delegate to the real `fetchUrl` method and throw `ManualPasteRequiredError` only to satisfy that interface's fixed `Promise<JobPosting>` return type — but the actual HTTP path (`GenericFetchController`) calls `fetchUrl` directly and returns the discriminated result as-is (201 either way, `status` field tells the caller which branch happened).

No generic HTML job-posting parser: extracting a reliable title/company from arbitrary markup would need real scraping heuristics, which is speculative complexity this ticket doesn't ask for. The user supplies `title`/`company` up front (`SubmitFetchUrlDto`, same shape as `ManualPasteAdapter`'s DTO minus `description`); a successful fetch's raw page text (untouched — same "inert data" treatment as every other adapter's raw payload) becomes `description`.

Domain denylist (`domain-denylist.ts`) is a hard-coded constant checked as the very first thing in `fetchUrl`, before the robots.txt fetch or the page fetch — proven by e2e assertions that the injected `GenericFetchClient` mock's `fetchRobotsTxt`/`fetchPage` were never called for a `linkedin.com`/`glassdoor.com` URL, not just a response-code check. robots.txt evaluation (`robots-txt.ts`) is a small hand-rolled parser (User-agent groups, Disallow/Allow prefix rules, longest-match-wins) rather than a new dependency — covers the common real-world case without the wildcard/`$`-pattern/crawl-delay handling a full spec implementation would need, which nothing here requires. The page fetch itself has a 10s timeout via `AbortController` — an arbitrary user-submitted URL needs one; a hanging server shouldn't hang the request.

New e2e file `test/generic-fetch.e2e-spec.ts`: successful fetch+normalize, fetch-failure fallback (no posting created), robots.txt-disallow fallback (page fetch never attempted), LinkedIn refusal (zero calls to either client method), Glassdoor subdomain refusal, and the standard no-token rejection. Full e2e suite: 54/54 across 13 files. `tsc --noEmit` and `nest build` clean.

**Live-verified** against the running Docker `api` container with real network calls: a real fetch against `example.com` (robots.txt fetched and allowed, real HTML stored verbatim as description, exactly one Job Posting created); `linkedin.com` and a `glassdoor.com` subdomain both refused instantly with a clear reason; a genuinely unreachable domain correctly fell back to `needs_manual_paste` rather than hanging or erroring; confirmed exactly one Job Posting exists afterward (the three fallback cases created none).
