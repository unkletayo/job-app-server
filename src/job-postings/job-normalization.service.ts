import { Injectable } from '@nestjs/common';
import { JobPosting, Prisma, SourcePosting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobClusterService } from './job-cluster.service';
import { RequirementExtractionService } from './requirement-extraction.service';
import { NormalizedJobFields, SourceReference } from './source-adapter';

export interface IngestResult {
  sourcePosting: SourcePosting;
  jobPosting: JobPosting;
}

const SERIALIZATION_FAILURE_RETRIES = 3;
const PRISMA_TRANSACTION_WRITE_CONFLICT = 'P2034';

/**
 * The shared pipeline every adapter (manual-paste today; Sanctioned Source
 * adapters from ticket 08+) funnels through: persist the raw payload
 * untouched as a SourcePosting, then either merge it into a matching Job
 * Cluster or start a new one, per JobClusterService's dedup signals. The raw
 * payload is never read for interpretation here — it's stored as inert data
 * (PRD §23/§63), whatever it contains.
 */
@Injectable()
export class JobNormalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobClusterService: JobClusterService,
    private readonly requirementExtraction: RequirementExtractionService,
  ) {}

  async ingest(
    userId: string,
    reference: SourceReference,
    rawData: object,
    normalized: NormalizedJobFields,
  ): Promise<IngestResult> {
    for (let attempt = 1; attempt <= SERIALIZATION_FAILURE_RETRIES; attempt++) {
      try {
        return await this.ingestOnce(userId, reference, rawData, normalized);
      } catch (error) {
        const isLastAttempt = attempt === SERIALIZATION_FAILURE_RETRIES;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === PRISMA_TRANSACTION_WRITE_CONFLICT &&
          !isLastAttempt
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('unreachable');
  }

  private async ingestOnce(
    userId: string,
    reference: SourceReference,
    rawData: object,
    normalized: NormalizedJobFields,
  ): Promise<IngestResult> {
    // Serializable, and the match-check + both creates all run on the same
    // transaction client: two near-simultaneous ingests for the same new job
    // can't both read "no match" and each start their own cluster — Postgres
    // aborts the loser (P2034) and ingest() retries it against the now-
    // committed cluster from the winner.
    return this.prisma.$transaction(
      async (tx) => {
        const existingClusterId = await this.jobClusterService.findMatchingClusterId(
          userId,
          reference,
          normalized,
          tx,
        );

        const jobClusterId =
          existingClusterId ?? (await tx.jobCluster.create({ data: { userId } })).id;

        const sourcePosting = await tx.sourcePosting.create({
          data: {
            userId,
            jobClusterId,
            ...reference,
            rawData: rawData as Prisma.InputJsonValue,
          },
        });

        // Merging into an existing cluster reuses its canonical Job Posting
        // unchanged — refreshing it from the newer posting's data is a later
        // concern, not this ticket's. Requirement extraction (ticket 06)
        // follows the same rule: it only runs for a newly created Job
        // Posting, since a merge doesn't change the description Requirements
        // were extracted from.
        if (existingClusterId) {
          const jobPosting = await tx.jobPosting.findUniqueOrThrow({ where: { jobClusterId } });
          return { sourcePosting, jobPosting };
        }

        const jobPosting = await tx.jobPosting.create({ data: { userId, jobClusterId, ...normalized } });

        const extracted = this.requirementExtraction.extract(normalized.description);
        if (extracted.length > 0) {
          await tx.requirement.createMany({
            data: extracted.map((requirement) => ({
              jobPostingId: jobPosting.id,
              category: requirement.category,
              text: requirement.text,
            })),
          });
        }

        return { sourcePosting, jobPosting };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
