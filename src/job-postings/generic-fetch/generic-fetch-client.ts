import { Injectable } from '@nestjs/common';

export const GENERIC_FETCH_USER_AGENT = 'JobSearchAgentBot/1.0';
const FETCH_TIMEOUT_MS = 10_000;

export interface FetchedPage {
  status: number;
  ok: boolean;
  text: string;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': GENERIC_FETCH_USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The one place that makes outbound HTTP calls for `GenericFetchAdapter` —
 * kept separate so tests can override just this boundary with a mock
 * (ticket 10: proving the domain denylist is checked *before* any network
 * call means asserting this was never invoked, not just checking a status
 * code) and so the adapter's own logic (denylist, robots.txt evaluation,
 * fallback) stays fetch-implementation-agnostic.
 */
@Injectable()
export class GenericFetchClient {
  /** Null means no robots.txt was found (a 404, or the fetch itself
   * failed) — treated as "no restrictions" by the caller, same as the
   * de-facto standard. */
  async fetchRobotsTxt(origin: string): Promise<string | null> {
    try {
      const response = await fetchWithTimeout(`${origin}/robots.txt`);
      if (!response.ok) {
        return null;
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  async fetchPage(url: string): Promise<FetchedPage> {
    const response = await fetchWithTimeout(url);
    return { status: response.status, ok: response.ok, text: await response.text() };
  }
}
