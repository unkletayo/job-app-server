import { Injectable } from '@nestjs/common';
import { DiscoverySource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoverySchedulerService } from './discovery-scheduler.service';
import { UpdateDiscoverySourceDto } from './dto/update-discovery-source.dto';

/**
 * Read/configure side of a user's discovery sources — separate from
 * `DiscoveryRunnerService` (which actually executes a run), same split as
 * `JobPostingsService` vs. `JobNormalizationService`. Sources are created
 * lazily (upsert) rather than requiring a prior "register" step, matching
 * `JobPreferencesService`'s auto-create-defaults precedent — a source
 * becomes configurable/queryable the moment it's referenced, run or not.
 */
@Injectable()
export class DiscoverySourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: DiscoverySchedulerService,
  ) {}

  findAll(userId: string): Promise<DiscoverySource[]> {
    return this.prisma.discoverySource.findMany({ where: { userId } });
  }

  findAllRuns(userId: string) {
    return this.prisma.discoveryRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { source: { select: { sourceKey: true } } },
    });
  }

  async update(
    userId: string,
    sourceKey: string,
    dto: UpdateDiscoverySourceDto,
  ): Promise<DiscoverySource> {
    const source = await this.prisma.discoverySource.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      update: dto,
      create: { userId, sourceKey, ...dto },
    });

    await this.scheduler.schedule(userId, sourceKey, source.intervalMinutes, source.enabled);
    return source;
  }
}
