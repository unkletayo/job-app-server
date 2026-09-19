import { Inject, Injectable, Logger } from '@nestjs/common';
import { DiscoveryRun } from '@prisma/client';
import { DISCOVERY_ADAPTERS, DiscoveryAdapterRegistry } from './discoverable-source-adapter';
import { DiscoveryRunnerService } from './discovery-runner.service';

/**
 * Runs discovery for every registered source, one cycle (ticket 07's
 * acceptance criterion: one source's adapter failing must not stop the
 * others, and must not crash the worker). `DiscoveryRunnerService.run`
 * already never throws on an adapter/ingest failure — it records a failed
 * `DiscoveryRun` and returns — but this loop still guards each call anyway,
 * so a defect in the runner itself couldn't silently take down the rest of
 * the cycle either.
 */
@Injectable()
export class DiscoveryCycleService {
  private readonly logger = new Logger(DiscoveryCycleService.name);

  constructor(
    private readonly runner: DiscoveryRunnerService,
    @Inject(DISCOVERY_ADAPTERS) private readonly adapters: DiscoveryAdapterRegistry,
  ) {}

  async runAll(userId: string): Promise<DiscoveryRun[]> {
    const results: DiscoveryRun[] = [];
    for (const sourceKey of Object.keys(this.adapters)) {
      try {
        results.push(await this.runner.run(userId, sourceKey));
      } catch (error) {
        this.logger.error(
          `Unexpected error running discovery for source "${sourceKey}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return results;
  }
}
