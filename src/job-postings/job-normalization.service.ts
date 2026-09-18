import { Injectable } from '@nestjs/common';
import { JobPosting, Prisma, SourcePosting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedJobFields } from './source-adapter';

export interface IngestResult {
  sourcePosting: SourcePosting;
  jobPosting: JobPosting;
}

/**
 * The shared pipeline every adapter (manual-paste today; Sanctioned Source
 * adapters from ticket 08+) funnels through: persist the raw payload
 * untouched as a SourcePosting, then persist the normalized result as a
 * JobPosting. The raw payload is never read for interpretation here — it's
 * stored as inert data (PRD §23/§63), whatever it contains.
 */
@Injectable()
export class JobNormalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    userId: string,
    source: string,
    sourceJobId: string,
    rawData: object,
    normalized: NormalizedJobFields,
  ): Promise<IngestResult> {
    const sourcePosting = await this.prisma.sourcePosting.create({
      data: {
        userId,
        source,
        sourceJobId,
        rawData: rawData as Prisma.InputJsonValue,
      },
    });

    const jobPosting = await this.prisma.jobPosting.create({
      data: {
        userId,
        sourcePostingId: sourcePosting.id,
        source,
        sourceJobId,
        ...normalized,
      },
    });

    return { sourcePosting, jobPosting };
  }
}
