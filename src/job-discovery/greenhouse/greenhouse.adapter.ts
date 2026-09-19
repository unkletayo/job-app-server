import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DiscoverableSourceAdapter,
  DiscoveredPosting,
  DiscoveryCheckpoint,
  DiscoveryPage,
} from '../discoverable-source-adapter';
import { GreenhouseClient } from './greenhouse-client';

/**
 * Real Sanctioned Source adapter for Greenhouse's public, unauthenticated
 * Job Board API (0001-source-integration-policy) — one HTTP GET per
 * `WatchedCompany` board, no auth needed. Greenhouse's API has no
 * pagination and no server-side "since" filter (confirmed against its own
 * docs), so incremental fetching happens client-side: `checkpoint.cursor`
 * holds the ISO timestamp of the previous run, and only jobs whose
 * `updated_at` is newer are returned. One board's HTTP failure is caught
 * and skipped here (logged, not thrown) so it can't stop the other
 * watched boards in the same run — the cross-*source* isolation
 * (Greenhouse vs. Lever) ticket 07 already provides structurally; this is
 * the same principle one level down, across boards within one source.
 */
@Injectable()
export class GreenhouseAdapter implements DiscoverableSourceAdapter {
  readonly sourceKey = 'greenhouse';

  private readonly logger = new Logger(GreenhouseAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GreenhouseClient,
  ) {}

  async fetchPage(userId: string, checkpoint: DiscoveryCheckpoint): Promise<DiscoveryPage> {
    const boards = await this.prisma.watchedCompany.findMany({
      where: { userId, source: this.sourceKey, enabled: true },
    });

    const since = checkpoint.cursor ? new Date(checkpoint.cursor) : null;
    const postings: DiscoveredPosting[] = [];
    let latestSeenJobId = checkpoint.lastSeenJobId;

    for (const board of boards) {
      let jobs;
      try {
        jobs = await this.client.fetchJobs(board.boardToken);
      } catch (error) {
        this.logger.warn(
          `Skipping Greenhouse board "${board.boardToken}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      for (const job of jobs) {
        const updatedAt = new Date(job.updated_at);
        if (since && updatedAt <= since) {
          continue;
        }

        const sourceJobId = `${board.boardToken}:${job.id}`;
        postings.push({
          reference: { source: this.sourceKey, sourceJobId },
          rawData: job as unknown as object,
          normalized: {
            company: board.label,
            title: job.title,
            description: job.content ?? '',
            location: job.location?.name ? [job.location.name] : [],
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
            applicationUrl: job.absolute_url,
            postedAt: null,
            deadline: null,
            sourceUpdatedAt: updatedAt,
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
