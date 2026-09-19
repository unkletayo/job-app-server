import { Inject, Injectable, Logger } from '@nestjs/common';
import { DiscoveryRun } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobNormalizationService } from '../job-postings/job-normalization.service';
import {
  DISCOVERY_ADAPTERS,
  DiscoveryAdapterRegistry,
  DiscoveryCheckpoint,
} from './discoverable-source-adapter';
import { DiscoveryRateLimiterService } from './discovery-rate-limiter.service';

/**
 * Runs one Sanctioned Source's discovery to completion (ticket 07): loads
 * the source's checkpoint, pages through the adapter until it reports no
 * more results, ingests every posting through the same
 * `JobNormalizationService` pipeline manual-paste uses, and always leaves
 * behind a recorded `DiscoveryRun` outcome — whether the run succeeded or
 * an adapter/posting failed partway through. Never throws: a missing
 * adapter or a mid-run exception is recorded as a failed run and returned,
 * not raised, so one source's failure can never take down a caller that's
 * running several sources in the same cycle (`DiscoveryCycleService`).
 */
@Injectable()
export class DiscoveryRunnerService {
  private readonly logger = new Logger(DiscoveryRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: JobNormalizationService,
    private readonly rateLimiter: DiscoveryRateLimiterService,
    @Inject(DISCOVERY_ADAPTERS) private readonly adapters: DiscoveryAdapterRegistry,
  ) {}

  async run(userId: string, sourceKey: string): Promise<DiscoveryRun> {
    const source = await this.prisma.discoverySource.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      update: {},
      create: { userId, sourceKey },
    });

    const run = await this.prisma.discoveryRun.create({
      data: { userId, sourceId: source.id, status: 'running' },
    });

    const adapter = this.adapters[sourceKey];
    if (!adapter) {
      return this.failRun(run.id, `No adapter registered for source "${sourceKey}".`);
    }

    let checkpoint: DiscoveryCheckpoint = {
      cursor: source.lastCursor,
      lastSeenJobId: source.lastSeenJobId,
    };
    let jobsFetched = 0;
    let jobsMerged = 0;
    let jobsCreated = 0;
    let failureCount = 0;
    let latestSeenJobId = source.lastSeenJobId;

    try {
      let hasMore = true;
      while (hasMore) {
        await this.rateLimiter.wait(sourceKey, source.requestsPerMinute);
        const page = await adapter.fetchPage(userId, checkpoint);

        for (const posting of page.postings) {
          jobsFetched++;
          try {
            const result = await this.normalization.ingest(
              userId,
              posting.reference,
              posting.rawData,
              posting.normalized,
            );
            result.merged ? jobsMerged++ : jobsCreated++;
            latestSeenJobId = posting.reference.sourceJobId;
          } catch (error) {
            failureCount++;
            this.logger.warn(
              `Failed to ingest posting ${posting.reference.source}/${posting.reference.sourceJobId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        checkpoint = page.nextCheckpoint;
        hasMore = page.hasMore;
      }

      await this.prisma.discoverySource.update({
        where: { id: source.id },
        data: {
          lastCursor: checkpoint.cursor,
          lastSeenJobId: latestSeenJobId,
          lastSuccessfulRunAt: new Date(),
        },
      });

      return this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          jobsFetched,
          jobsMerged,
          jobsCreated,
          failureCount,
        },
      });
    } catch (error) {
      return this.failRun(
        run.id,
        error instanceof Error ? error.message : String(error),
        { jobsFetched, jobsMerged, jobsCreated, failureCount },
      );
    }
  }

  private async failRun(
    runId: string,
    errorMessage: string,
    counts: { jobsFetched: number; jobsMerged: number; jobsCreated: number; failureCount: number } = {
      jobsFetched: 0,
      jobsMerged: 0,
      jobsCreated: 0,
      failureCount: 0,
    },
  ): Promise<DiscoveryRun> {
    this.logger.warn(`Discovery run ${runId} failed: ${errorMessage}`);
    return this.prisma.discoveryRun.update({
      where: { id: runId },
      data: { status: 'failed', finishedAt: new Date(), errorMessage, ...counts },
    });
  }
}
