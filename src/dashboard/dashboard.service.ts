import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';

export interface ListJobsOptions {
  /** Postings scoring below this (or with no score at all — nothing to
   * measure against isn't "above the threshold") are left out. */
  minScore?: number;
}

/**
 * The dashboard read API (ticket 12, spec's "Dashboard/query module") — the
 * one place the user reviews discovered Job Postings with their current
 * Match Score. Hard-filtered-out postings never appear here: PRD's whole
 * point of a hard filter is that the user shouldn't have to look at a
 * disqualified job. They're still reachable individually via
 * `GET /job-postings/:id` (ticket 11), which does show `excluded` — this
 * endpoint just isn't where a disqualified posting gets surfaced.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  async listJobs(userId: string, options: ListJobsOptions = {}) {
    const jobPostings = await this.prisma.jobPosting.findMany({
      where: { userId },
      include: { extractedRequirements: true },
    });

    const scores = await this.matching.scoreMany(userId, jobPostings);

    return jobPostings
      .map((jobPosting, index) => {
        const { extractedRequirements: _extractedRequirements, ...posting } = jobPosting;
        return { ...posting, matchScore: scores[index] };
      })
      .filter((posting) => {
        if (posting.matchScore.excluded) return false;
        if (options.minScore === undefined) return true;
        return posting.matchScore.score !== null && posting.matchScore.score >= options.minScore;
      })
      .sort((a, b) => (b.matchScore.score ?? -1) - (a.matchScore.score ?? -1));
  }
}
