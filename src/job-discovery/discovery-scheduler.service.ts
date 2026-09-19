import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DISCOVERY_ADAPTERS, DiscoveryAdapterRegistry } from './discoverable-source-adapter';
import { DISCOVERY_QUEUE } from './job-discovery.constants';

/**
 * Registers a periodic BullMQ job per registered source (ticket 07's
 * "runs on a periodic schedule, default every 6 hours, configurable").
 * `upsertJobScheduler` is idempotent on `jobSchedulerId` (the sourceKey), so
 * re-running this on every boot — or after a config change via
 * `DiscoverySourcesService` — just replaces the existing schedule rather
 * than piling up duplicates. This app is solo-first (0005) — there is only
 * ever one local user, looked up at schedule time rather than baked in.
 */
@Injectable()
export class DiscoverySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DiscoverySchedulerService.name);

  constructor(
    @InjectQueue(DISCOVERY_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    @Inject(DISCOVERY_ADAPTERS) private readonly adapters: DiscoveryAdapterRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const user = await this.prisma.user.findFirst();
    if (!user) {
      return;
    }
    for (const sourceKey of Object.keys(this.adapters)) {
      const source = await this.prisma.discoverySource.upsert({
        where: { userId_sourceKey: { userId: user.id, sourceKey } },
        update: {},
        create: { userId: user.id, sourceKey },
      });
      await this.schedule(user.id, sourceKey, source.intervalMinutes, source.enabled);
    }
  }

  async schedule(
    userId: string,
    sourceKey: string,
    intervalMinutes: number,
    enabled: boolean,
  ): Promise<void> {
    if (!enabled) {
      await this.queue.removeJobScheduler(sourceKey);
      return;
    }
    await this.queue.upsertJobScheduler(
      sourceKey,
      { every: intervalMinutes * 60_000 },
      {
        name: sourceKey,
        data: { userId, sourceKey },
        opts: { attempts: 5, backoff: { type: 'exponential', delay: 30_000, jitter: 0.5 } },
      },
    );
    this.logger.log(`Scheduled discovery for "${sourceKey}" every ${intervalMinutes}m.`);
  }
}
