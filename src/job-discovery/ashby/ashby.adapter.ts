import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DiscoverableSourceAdapter,
  DiscoveredPosting,
  DiscoveryCheckpoint,
  DiscoveryPage,
} from '../discoverable-source-adapter';
import { AshbyClient } from './ashby-client';

/**
 * Real Sanctioned Source adapter for Ashby's public, unauthenticated Job
 * Postings API (0001-source-integration-policy) — one HTTP GET per
 * `WatchedCompany` board. No pagination, no since-filter (verified live
 * against api.ashbyhq.com — same limitation as Greenhouse). Unlike
 * Greenhouse's `updated_at`, Ashby only exposes `publishedAt` — a
 * creation-time signal, not a last-*edited* one — so `checkpoint.cursor`
 * (previous run's timestamp) filtering here catches new listings
 * reliably but, same as Greenhouse's equivalent, wouldn't catch an edit to
 * an already-published job that didn't bump the field. Only `isListed`
 * jobs are surfaced — Ashby returns unlisted/draft jobs too, which aren't
 * meant to be publicly discoverable.
 */
@Injectable()
export class AshbyAdapter implements DiscoverableSourceAdapter {
  readonly sourceKey = 'ashby';

  private readonly logger = new Logger(AshbyAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: AshbyClient,
  ) {}

  async fetchPage(userId: string, checkpoint: DiscoveryCheckpoint): Promise<DiscoveryPage> {
    const boards = await this.prisma.watchedCompany.findMany({
      where: { userId, source: this.sourceKey, enabled: true },
    });

    // No boards to query — leave the checkpoint untouched rather than
    // advancing it to "now". Otherwise a board added later would have every
    // one of its existing (older) jobs silently filtered out forever, since
    // this adapter's incremental filter is purely time-based.
    if (boards.length === 0) {
      return { postings: [], nextCheckpoint: checkpoint, hasMore: false };
    }

    const since = checkpoint.cursor ? new Date(checkpoint.cursor) : null;
    const postings: DiscoveredPosting[] = [];
    let latestSeenJobId = checkpoint.lastSeenJobId;

    for (const board of boards) {
      let jobs;
      try {
        jobs = await this.client.fetchJobs(board.boardToken);
      } catch (error) {
        this.logger.warn(
          `Skipping Ashby board "${board.boardToken}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      for (const job of jobs) {
        if (!job.isListed) {
          continue;
        }
        const publishedAt = new Date(job.publishedAt);
        if (since && publishedAt <= since) {
          continue;
        }

        const sourceJobId = `${board.boardToken}:${job.id}`;
        postings.push({
          reference: { source: this.sourceKey, sourceJobId },
          rawData: job as unknown as object,
          normalized: {
            company: board.label,
            title: job.title,
            description: job.descriptionPlain ?? '',
            location: job.location ? [job.location] : [],
            remoteType: job.workplaceType ?? null,
            employmentType: job.employmentType ?? null,
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            seniority: null,
            skills: [],
            requirements: [],
            preferredQualifications: [],
            educationRequirements: [],
            experienceRequirements: [],
            applicationUrl: job.applyUrl ?? job.jobUrl ?? null,
            postedAt: publishedAt,
            deadline: null,
            sourceUpdatedAt: publishedAt,
          },
        });
        latestSeenJobId = sourceJobId;
      }
    }

    return {
      postings,
      nextCheckpoint: { cursor: new Date().toISOString(), lastSeenJobId: latestSeenJobId },
      hasMore: false,
    };
  }
}
