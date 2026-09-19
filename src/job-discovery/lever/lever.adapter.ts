import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DiscoverableSourceAdapter,
  DiscoveredPosting,
  DiscoveryCheckpoint,
  DiscoveryPage,
} from '../discoverable-source-adapter';
import { LeverClient } from './lever-client';

/**
 * Real Sanctioned Source adapter for Lever's public, unauthenticated
 * Postings API (0001-source-integration-policy) — one HTTP GET per
 * `WatchedCompany` board. Unlike Greenhouse, Lever's postings carry no
 * created/updated timestamp at all, so there's no time-based "since" to
 * filter on. Incremental fetching here means seen-id dedup instead:
 * `checkpoint.cursor` holds a JSON-encoded array of every `sourceJobId`
 * already returned, and each run only reports postings not already in
 * that set. This is a deliberate, documented adaptation to what Lever's
 * API actually exposes, not an approximation of Greenhouse's approach.
 */
@Injectable()
export class LeverAdapter implements DiscoverableSourceAdapter {
  readonly sourceKey = 'lever';

  private readonly logger = new Logger(LeverAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: LeverClient,
  ) {}

  async fetchPage(userId: string, checkpoint: DiscoveryCheckpoint): Promise<DiscoveryPage> {
    const boards = await this.prisma.watchedCompany.findMany({
      where: { userId, source: this.sourceKey, enabled: true },
    });

    const seenIds = new Set<string>(checkpoint.cursor ? JSON.parse(checkpoint.cursor) : []);
    const postings: DiscoveredPosting[] = [];
    let latestSeenJobId = checkpoint.lastSeenJobId;

    for (const board of boards) {
      let items;
      try {
        items = await this.client.fetchPostings(board.boardToken);
      } catch (error) {
        this.logger.warn(
          `Skipping Lever board "${board.boardToken}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      for (const item of items) {
        const sourceJobId = `${board.boardToken}:${item.id}`;
        if (seenIds.has(sourceJobId)) {
          continue;
        }

        postings.push({
          reference: { source: this.sourceKey, sourceJobId },
          rawData: item as unknown as object,
          normalized: {
            company: board.label,
            title: item.text,
            description: item.descriptionPlain ?? '',
            location: item.categories?.location ? [item.categories.location] : [],
            remoteType: null,
            employmentType: item.categories?.commitment ?? null,
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            seniority: null,
            skills: [],
            requirements: [],
            preferredQualifications: [],
            educationRequirements: [],
            experienceRequirements: [],
            applicationUrl: item.hostedUrl ?? null,
            postedAt: null,
            deadline: null,
            sourceUpdatedAt: null,
          },
        });
        seenIds.add(sourceJobId);
        latestSeenJobId = sourceJobId;
      }
    }

    return {
      postings,
      nextCheckpoint: { cursor: JSON.stringify([...seenIds]), lastSeenJobId: latestSeenJobId },
      hasMore: false,
    };
  }
}
