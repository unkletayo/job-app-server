import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { JobPostingsModule } from '../job-postings/job-postings.module';
import { DISCOVERY_ADAPTERS, DiscoveryAdapterRegistry } from './discoverable-source-adapter';
import { DISCOVERY_QUEUE } from './job-discovery.constants';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryRunnerService } from './discovery-runner.service';
import { DiscoveryCycleService } from './discovery-cycle.service';
import { DiscoveryRateLimiterService } from './discovery-rate-limiter.service';
import { DiscoverySchedulerService } from './discovery-scheduler.service';
import { DiscoverySourcesService } from './discovery-sources.service';
import { DiscoveryProcessor } from './discovery.processor';
import { GreenhouseClient } from './greenhouse/greenhouse-client';
import { GreenhouseAdapter } from './greenhouse/greenhouse.adapter';
import { LeverClient } from './lever/lever-client';
import { LeverAdapter } from './lever/lever.adapter';
import { WatchedCompaniesController } from './watched-companies/watched-companies.controller';
import { WatchedCompaniesService } from './watched-companies/watched-companies.service';

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
  controllers: [DiscoveryController, WatchedCompaniesController],
  providers: [
    {
      provide: DISCOVERY_ADAPTERS,
      inject: [GreenhouseAdapter, LeverAdapter],
      useFactory: (greenhouse: GreenhouseAdapter, lever: LeverAdapter): DiscoveryAdapterRegistry => ({
        [greenhouse.sourceKey]: greenhouse,
        [lever.sourceKey]: lever,
      }),
    },
    DiscoveryRunnerService,
    DiscoveryCycleService,
    DiscoveryRateLimiterService,
    DiscoverySchedulerService,
    DiscoverySourcesService,
    DiscoveryProcessor,
    GreenhouseClient,
    GreenhouseAdapter,
    LeverClient,
    LeverAdapter,
    WatchedCompaniesService,
  ],
  exports: [DiscoveryRunnerService, DiscoveryCycleService],
})
export class JobDiscoveryModule {}
