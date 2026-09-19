import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DiscoverableSourceAdapter,
  DiscoveredPosting,
  DiscoveryCheckpoint,
  DiscoveryPage,
} from '../discoverable-source-adapter';
import { SmartRecruitersClient } from './smartrecruiters-client';

/**
 * Real Sanctioned Source adapter for SmartRecruiters' public Posting API
 * (0001-source-integration-policy). Verified live against
 * api.smartrecruiters.com: the list endpoint returns no description
 * content and no confirmed date-filter parameter, so — same situation as
 * Lever, and for the same reason (nothing reliable to filter by time) —
 * incremental fetching here is a persisted seen-id set in
 * `checkpoint.cursor`, not a "since" comparison. Description content
 * requires a second, per-posting detail call, made only for postings not
 * already in the seen-id set, so a steady-state run with nothing new
 * makes exactly one list call and no detail calls.
 */
@Injectable()
export class SmartRecruitersAdapter implements DiscoverableSourceAdapter {
  readonly sourceKey = 'smartrecruiters';

  private readonly logger = new Logger(SmartRecruitersAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SmartRecruitersClient,
  ) {}

  async fetchPage(userId: string, checkpoint: DiscoveryCheckpoint): Promise<DiscoveryPage> {
    const boards = await this.prisma.watchedCompany.findMany({
      where: { userId, source: this.sourceKey, enabled: true },
    });

    const seenIds = new Set<string>(checkpoint.cursor ? JSON.parse(checkpoint.cursor) : []);
    const postings: DiscoveredPosting[] = [];
    let latestSeenJobId = checkpoint.lastSeenJobId;

    for (const board of boards) {
      let summaries;
      try {
        summaries = await this.client.listPostings(board.boardToken);
      } catch (error) {
        this.logger.warn(
          `Skipping SmartRecruiters board "${board.boardToken}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      for (const summary of summaries) {
        const sourceJobId = `${board.boardToken}:${summary.id}`;
        if (seenIds.has(sourceJobId)) {
          continue;
        }

        let detail;
        try {
          detail = await this.client.fetchPosting(board.boardToken, summary.id);
        } catch (error) {
          this.logger.warn(
            `Skipping SmartRecruiters posting "${summary.id}" on "${board.boardToken}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          continue;
        }

        const description = Object.values(detail.jobAd?.sections ?? {})
          .filter((section): section is { title: string; text: string } => Boolean(section?.text))
          .map((section) => section.text)
          .join('\n\n');

        postings.push({
          reference: { source: this.sourceKey, sourceJobId },
          rawData: { ...summary, ...detail } as unknown as object,
          normalized: {
            company: board.label,
            title: summary.name.trim(),
            description,
            location: summary.location?.fullLocation ? [summary.location.fullLocation] : [],
            remoteType: summary.location?.remote ? 'Remote' : null,
            employmentType: summary.typeOfEmployment?.label ?? null,
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            seniority: null,
            skills: [],
            requirements: [],
            preferredQualifications: [],
            educationRequirements: [],
            experienceRequirements: [],
            applicationUrl: detail.applyUrl ?? detail.postingUrl ?? null,
            postedAt: new Date(summary.releasedDate),
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
