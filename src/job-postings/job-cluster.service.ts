import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedJobFields, SourceReference } from './source-adapter';

/** Whatever Prisma client this runs against — the app's singleton, or a
 * transaction client mid-`$transaction`. Matching must run on the same
 * client as the writes that follow it, or the two can't see each other's
 * in-flight state consistently. */
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocation(location: string[]): string {
  return [...location].map(normalizeText).sort().join('|');
}

/**
 * Finds an existing Job Cluster that an incoming posting belongs to, per
 * 0003-deterministic-first-matching's signals: external job id (same source
 * + sourceJobId as an existing Source Posting), canonical application URL,
 * or company + title + location. No description-similarity or embedding
 * step; a later layer, not this one.
 */
@Injectable()
export class JobClusterService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatchingClusterId(
    userId: string,
    reference: SourceReference,
    normalized: NormalizedJobFields,
    client: PrismaClientLike = this.prisma,
  ): Promise<string | null> {
    const byExternalId = await client.sourcePosting.findFirst({
      where: { userId, source: reference.source, sourceJobId: reference.sourceJobId },
      select: { jobClusterId: true },
    });
    if (byExternalId) {
      return byExternalId.jobClusterId;
    }

    if (normalized.applicationUrl) {
      const byUrl = await client.jobPosting.findFirst({
        where: { userId, applicationUrl: normalized.applicationUrl },
        select: { jobClusterId: true },
      });
      if (byUrl) {
        return byUrl.jobClusterId;
      }
    }

    const candidates = await client.jobPosting.findMany({
      where: { userId },
      select: { jobClusterId: true, company: true, title: true, location: true },
    });

    const incomingCompany = normalizeText(normalized.company);
    const incomingTitle = normalizeText(normalized.title);
    const incomingLocation = normalizeLocation(normalized.location);

    const match = candidates.find(
      (candidate) =>
        normalizeText(candidate.company) === incomingCompany &&
        normalizeText(candidate.title) === incomingTitle &&
        normalizeLocation(candidate.location) === incomingLocation,
    );

    return match ? match.jobClusterId : null;
  }
}
