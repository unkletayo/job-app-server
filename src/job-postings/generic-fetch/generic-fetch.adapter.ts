import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JobPosting } from '@prisma/client';
import { JobNormalizationService } from '../job-normalization.service';
import { ApplicationCapabilities, JobSourceAdapter, SearchResult, SourceReference } from '../source-adapter';
import { SubmitFetchUrlDto } from './dto/submit-fetch-url.dto';
import { GenericFetchClient, GENERIC_FETCH_USER_AGENT } from './generic-fetch-client';
import { isDenylistedHostname } from './domain-denylist';
import { isPathAllowed } from './robots-txt';

export const GENERIC_FETCH_SOURCE = 'generic_fetch';

export type FetchUrlResult =
  | { status: 'ingested'; jobPosting: JobPosting }
  | { status: 'needs_manual_paste'; reason: string };

/** Thrown by `getJob`/`search` (the shared `JobSourceAdapter` interface,
 * which has no room for a "couldn't fetch, please paste" outcome) — real
 * callers use `fetchUrl` directly and get the discriminated result instead,
 * since this is an expected, first-class outcome, not an error. */
export class ManualPasteRequiredError extends Error {}

/**
 * `GenericFetchAdapter` (ticket 10) — the only adapter allowed to fetch a
 * source not on the Sanctioned Source list (0001-source-integration-policy,
 * spec §48), for an arbitrary user-submitted URL. The domain denylist check
 * runs first, before any network call of any kind, and cannot be bypassed
 * by adapter configuration — it's a hard-coded constant
 * (`domain-denylist.ts`), not a setting. robots.txt is fetched and checked
 * next; only if both pass does it attempt the actual page fetch.
 *
 * There's no generic HTML job-posting parser here — extracting a real
 * title/company from arbitrary markup reliably would need real scraping
 * heuristics, which is speculative complexity this ticket doesn't ask for.
 * The user supplies title/company up front (same as `ManualPasteAdapter`);
 * a successful fetch's raw page text becomes the description. Any failure
 * — denylisted domain, robots.txt disallow, or the fetch itself failing —
 * produces the same `needs_manual_paste` outcome so the caller can fall
 * back to the existing manual-paste flow, never a silent failure or a
 * retry loop.
 */
@Injectable()
export class GenericFetchAdapter
  implements JobSourceAdapter<SubmitFetchUrlDto, SubmitFetchUrlDto>
{
  constructor(
    private readonly normalization: JobNormalizationService,
    private readonly client: GenericFetchClient,
  ) {}

  async fetchUrl(userId: string, dto: SubmitFetchUrlDto): Promise<FetchUrlResult> {
    const url = new URL(dto.url);

    if (isDenylistedHostname(url.hostname)) {
      return {
        status: 'needs_manual_paste',
        reason: `${url.hostname} is a Manual-Assist source (0001-source-integration-policy) — this app never makes a request to it. Paste the job's content instead.`,
      };
    }

    const robotsTxt = await this.client.fetchRobotsTxt(url.origin);
    if (robotsTxt && !isPathAllowed(robotsTxt, url.pathname, GENERIC_FETCH_USER_AGENT)) {
      return { status: 'needs_manual_paste', reason: "This page's robots.txt disallows fetching it." };
    }

    let page;
    try {
      page = await this.client.fetchPage(dto.url);
    } catch (error) {
      return {
        status: 'needs_manual_paste',
        reason: `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (!page.ok) {
      return { status: 'needs_manual_paste', reason: `Fetch failed: server responded ${page.status}.` };
    }

    const reference: SourceReference = { source: GENERIC_FETCH_SOURCE, sourceJobId: randomUUID() };
    const { jobPosting } = await this.normalization.ingest(
      userId,
      reference,
      { title: dto.title, company: dto.company, location: dto.location, url: dto.url, fetchedContent: page.text },
      {
        company: dto.company,
        title: dto.title,
        description: page.text,
        location: dto.location ? [dto.location] : [],
        remoteType: null,
        employmentType: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        seniority: null,
        skills: [],
        requirements: [],
        preferredQualifications: [],
        educationRequirements: [],
        experienceRequirements: [],
        applicationUrl: dto.url,
        postedAt: null,
        deadline: null,
        sourceUpdatedAt: null,
      },
    );

    return { status: 'ingested', jobPosting };
  }

  async search(userId: string, query: SubmitFetchUrlDto): Promise<SearchResult> {
    const result = await this.fetchUrl(userId, query);
    if (result.status === 'needs_manual_paste') {
      return { jobs: [], hasMore: false };
    }
    return { jobs: [result.jobPosting], hasMore: false };
  }

  async getJob(userId: string, id: SubmitFetchUrlDto): Promise<JobPosting> {
    const result = await this.fetchUrl(userId, id);
    if (result.status === 'needs_manual_paste') {
      throw new ManualPasteRequiredError(result.reason);
    }
    return result.jobPosting;
  }

  supportsApplication(): boolean {
    return false;
  }

  getApplicationCapabilities(): ApplicationCapabilities {
    return { supported: false, requiresManualSubmission: true };
  }

  prepareApplication(): Promise<never> {
    return Promise.reject(
      new Error('GenericFetchAdapter does not support application preparation in this phase.'),
    );
  }
}
