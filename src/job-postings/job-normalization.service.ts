import { Injectable } from '@nestjs/common';
import { JobPosting, Prisma, SourcePosting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobClusterService } from './job-cluster.service';
import { NormalizedJobFields, SourceReference } from './source-adapter';

export interface IngestResult {
  sourcePosting: SourcePosting;
  jobPosting: JobPosting;
  /** True when this posting was merged into an existing Job Cluster rather
   * than starting a new one. */
  merged: boolean;
}

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
  ) {}

  async ingest(
    userId: string,
    reference: SourceReference,
    rawData: object,
    normalized: NormalizedJobFields,
  ): Promise<IngestResult> {
    const existingClusterId = await this.jobClusterService.findMatchingClusterId(userId, normalized);

    const jobClusterId =
      existingClusterId ?? (await this.prisma.jobCluster.create({ data: { userId } })).id;

    const sourcePosting = await this.prisma.sourcePosting.create({
      data: {
        userId,
        jobClusterId,
        ...reference,
        rawData: rawData as Prisma.InputJsonValue,
      },
    });

    // Merging into an existing cluster reuses its canonical Job Posting
    // unchanged — refreshing it from the newer posting's data is a later
    // concern, not this ticket's.
    const jobPosting = existingClusterId
      ? await this.prisma.jobPosting.findUniqueOrThrow({ where: { jobClusterId } })
      : await this.prisma.jobPosting.create({ data: { userId, jobClusterId, ...normalized } });

    return { sourcePosting, jobPosting, merged: existingClusterId !== null };
  }
}
