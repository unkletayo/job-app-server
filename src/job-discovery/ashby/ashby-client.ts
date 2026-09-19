import { Injectable } from '@nestjs/common';

/** Shape of an Ashby public Job Postings API job, per
 * https://developers.ashbyhq.com/docs/public-job-posting-api (verified
 * live against api.ashbyhq.com). Only the fields this adapter reads. */
export interface AshbyJob {
  id: string;
  title: string;
  location: string;
  department?: string;
  employmentType?: string;
  workplaceType?: string;
  isListed: boolean;
  publishedAt: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
}

interface AshbyJobBoardResponse {
  jobs: AshbyJob[];
}

/**
 * The one place that makes an outbound HTTP call to Ashby — kept separate
 * from `AshbyAdapter` so tests can override just this boundary with a
 * fixture-serving stub (ticket 09: "not live network calls in CI").
 */
@Injectable()
export class AshbyClient {
  async fetchJobs(boardToken: string): Promise<AshbyJob[]> {
    const response = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}`,
    );
    if (!response.ok) {
      throw new Error(`Ashby API returned ${response.status} for board "${boardToken}".`);
    }
    const data = (await response.json()) as AshbyJobBoardResponse;
    return data.jobs;
  }
}
