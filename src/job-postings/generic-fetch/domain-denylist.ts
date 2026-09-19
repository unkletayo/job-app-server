/**
 * The hard-coded, non-configurable Manual-Assist domain list
 * (0001-source-integration-policy, CONTEXT.md) — `GenericFetchAdapter` must
 * refuse these even if asked, so this lives as a constant checked first in
 * the adapter, not as adapter config that could be edited around.
 */
export const DENYLISTED_DOMAINS = ['linkedin.com', 'glassdoor.com'] as const;

export function isDenylistedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return DENYLISTED_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}
