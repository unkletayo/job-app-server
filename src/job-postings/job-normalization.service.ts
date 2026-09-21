import { Injectable } from '@nestjs/common';
import { JobPosting, Prisma, SourcePosting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobClusterService } from './job-cluster.service';
import { RequirementExtractionService } from './requirement-extraction.service';
import { NormalizedJobFields, SourceReference } from './source-adapter';
import { htmlToPlainText } from './text-normalization';

export interface IngestResult {
  sourcePosting: SourcePosting;
  jobPosting: JobPosting;
  /** Whether this posting joined an existing Job Cluster rather than
   * starting a new one — ticket 07's discovery run outcome (jobs merged vs.
   * new clusters created) is the first real consumer of this. */
  merged: boolean;
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
          return { sourcePosting, jobPosting, merged: true };
        }

        // The Job Posting is the normalized record, so its description is
        // stored as plain text; the SourcePosting above keeps the original
        // markup untouched.
        const jobPosting = await tx.jobPosting.create({
          data: { userId, jobClusterId, ...normalized, description: htmlToPlainText(normalized.description) },
        });
        await this.saveRequirements(tx, jobPosting.id, jobPosting.description);

        return { sourcePosting, jobPosting, merged: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Re-normalizes the description and rebuilds the Requirements of every one
   * of the user's Job Postings. Requirements are otherwise only extracted at
   * first ingest, so postings ingested before an extraction fix keep stale
   * Requirements (and, for Greenhouse, an entity-encoded description) until
   * this runs.
   *
   * One transaction per posting, so a failure part-way leaves earlier
   * postings done and the run safe to repeat. `htmlToPlainText` is not
   * idempotent for text that legitimately contains entity-like sequences
   * (`&amp;lt;` written out literally), which each run would decode further.
   */
  async reExtractAll(userId: string): Promise<{ reExtracted: number }> {
    const jobPostings = await this.prisma.jobPosting.findMany({
      where: { userId },
      select: { id: true },
    });

    let reExtracted = 0;
    for (const { id } of jobPostings) {
      await this.prisma.$transaction(async (tx) => {
        // Lock the row before touching its Requirements: two overlapping
        // runs would otherwise interleave delete/create and leave duplicates.
        // The description is read after the lock so a waiting run sees what
        // the run before it wrote.
        const locked = await tx.$queryRaw<{ description: string }[]>`
          SELECT description FROM job_postings WHERE id = ${id} FOR UPDATE`;
        if (locked.length === 0) return; // deleted since the list was read

        const { description } = locked[0];
        const plainText = htmlToPlainText(description);
        if (plainText !== description) {
          await tx.jobPosting.update({ where: { id }, data: { description: plainText } });
        }
        await tx.requirement.deleteMany({ where: { jobPostingId: id } });
        await this.saveRequirements(tx, id, plainText);
        reExtracted++;
      });
    }

    return { reExtracted };
  }

  private async saveRequirements(
    tx: Prisma.TransactionClient,
    jobPostingId: string,
    description: string,
  ): Promise<void> {
    const extracted = this.requirementExtraction.extract(description);
    if (extracted.length > 0) {
      await tx.requirement.createMany({
        data: extracted.map((requirement) => ({
          jobPostingId,
          category: requirement.category,
          text: requirement.text,
        })),
      });
    }
  }
}
