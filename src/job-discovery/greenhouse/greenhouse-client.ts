import { Injectable } from '@nestjs/common';

/** Shape of a Greenhouse Job Board API job, per
 * https://docs.greenhouse.io/job-board.html (`?content=true`). Only the
 * fields this adapter actually reads. */
export interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location: { name: string } | null;
  content?: string;
}

interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[];
}

/**
 * The one place that makes an outbound HTTP call to Greenhouse — kept
 * separate from `GreenhouseAdapter` so tests can override just this
 * boundary with a fixture-serving stub (ticket 08: "not live network calls
 * in CI") while exercising the real adapter's normalization/checkpoint
 * logic untouched.
 */
@Injectable()
export class GreenhouseClient {
  async fetchJobs(boardToken: string): Promise<GreenhouseJob[]> {
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`,
    );
    if (!response.ok) {
      throw new Error(
        `Greenhouse API returned ${response.status} for board "${boardToken}".`,
      );
    }
    const data = (await response.json()) as GreenhouseJobsResponse;
    return data.jobs;
  }
}
