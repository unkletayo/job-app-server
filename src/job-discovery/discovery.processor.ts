import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DiscoveryRunnerService } from './discovery-runner.service';
import { DISCOVERY_QUEUE } from './job-discovery.constants';

interface DiscoveryJobData {
  userId: string;
  sourceKey: string;
}

/**
 * Consumes the periodic discovery jobs `DiscoverySchedulerService` enqueues
 * (and the manual-trigger ones from `DiscoveryController`). Throwing here
 * when a run failed is what makes BullMQ apply the job's configured
 * exponential-backoff-with-jitter before retrying — `DiscoveryRunnerService`
 * itself never throws, it just records the outcome, so this is the one
 * place that turns "recorded failure" into "the queue should back off and
 * retry."
 */
@Processor(DISCOVERY_QUEUE)
export class DiscoveryProcessor extends WorkerHost {
  constructor(private readonly runner: DiscoveryRunnerService) {
    super();
  }

  async process(job: Job<DiscoveryJobData>): Promise<void> {
    const run = await this.runner.run(job.data.userId, job.data.sourceKey);
    if (run.status === 'failed') {
      throw new Error(run.errorMessage ?? `Discovery run ${run.id} failed.`);
    }
  }
}
