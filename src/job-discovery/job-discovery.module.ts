import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { JobPostingsModule } from '../job-postings/job-postings.module';
import { DISCOVERY_ADAPTERS } from './discoverable-source-adapter';
import { DISCOVERY_QUEUE } from './job-discovery.constants';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryRunnerService } from './discovery-runner.service';
import { DiscoveryCycleService } from './discovery-cycle.service';
import { DiscoveryRateLimiterService } from './discovery-rate-limiter.service';
import { DiscoverySchedulerService } from './discovery-scheduler.service';
import { DiscoverySourcesService } from './discovery-sources.service';
import { DiscoveryProcessor } from './discovery.processor';

@Module({
  imports: [
    JobPostingsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // A pre-built IORedis instance, not a URL string — BullMQ's
        // `connection` option doesn't parse URLs itself, and `ioredis` must
        // be this project's own direct dependency (bullmq only lists it as
        // an optional peer and won't resolve it under pnpm's strict linking
        // otherwise). Workers require `maxRetriesPerRequest: null`.
        connection: new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    BullModule.registerQueue({ name: DISCOVERY_QUEUE }),
  ],
  controllers: [DiscoveryController],
  providers: [
    { provide: DISCOVERY_ADAPTERS, useValue: {} },
    DiscoveryRunnerService,
    DiscoveryCycleService,
    DiscoveryRateLimiterService,
    DiscoverySchedulerService,
    DiscoverySourcesService,
    DiscoveryProcessor,
  ],
  exports: [DiscoveryRunnerService, DiscoveryCycleService],
})
export class JobDiscoveryModule {}
