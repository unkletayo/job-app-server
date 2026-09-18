# 10 — GenericFetchAdapter + LinkedIn/Glassdoor denylist

**What to build:** Support for custom/unlisted job URLs — the system attempts an automated fetch of the specific page, falling back to asking the user to paste the content if the fetch fails or is blocked (robots.txt-respecting). This ticket also hard-codes the domain denylist that makes [[0001-source-integration-policy]] an enforced invariant rather than a convention: `GenericFetchAdapter` must refuse to ever fetch `linkedin.com` or `glassdoor.com`, full stop, even if asked.

**Blocked by:** 07 — needs the scheduler/adapter harness to plug into (though this adapter is typically invoked on-demand from a user-submitted URL, not purely on a schedule).

**Status:** ready-for-agent

- [ ] `GenericFetchAdapter` implements `JobSourceAdapter`; given an arbitrary job URL, attempts a fetch, checks robots.txt, and on success normalizes the result via the ticket 04 pipeline
- [ ] On fetch failure or robots.txt disallow, the adapter returns a clear "needs manual paste" state rather than silently failing or retrying indefinitely
- [ ] A hard-coded domain denylist rejects any fetch attempt targeting `linkedin.com` or `glassdoor.com` (or their subdomains) before any network request is made — this check cannot be bypassed by adapter configuration
- [ ] e2e/integration tests cover: successful generic fetch, fetch failure falling back to manual-paste state, and — critically — an attempt to fetch a `linkedin.com`/`glassdoor.com` URL through this adapter is refused with no outbound request made (assert via network-call spy/mock, not just response code)
