import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedJobFields } from './source-adapter';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocation(location: string[]): string {
  return [...location].map(normalizeText).sort().join('|');
}

/**
 * Finds an existing Job Cluster that an incoming normalized posting belongs
 * to, per 0003-deterministic-first-matching's signals — canonical
 * application URL, or company + title + location. No description-similarity
 * or embedding step; a later layer, not this one.
 */
@Injectable()
export class JobClusterService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatchingClusterId(userId: string, normalized: NormalizedJobFields): Promise<string | null> {
    if (normalized.applicationUrl) {
      const byUrl = await this.prisma.jobPosting.findFirst({
        where: { userId, applicationUrl: normalized.applicationUrl },
        select: { jobClusterId: true },
      });
      if (byUrl) {
        return byUrl.jobClusterId;
      }
    }

    const candidates = await this.prisma.jobPosting.findMany({
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
