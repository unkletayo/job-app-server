import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { DiscoverySourcesService } from './discovery-sources.service';
import { DiscoveryRunnerService } from './discovery-runner.service';
import { DiscoveryCycleService } from './discovery-cycle.service';
import { UpdateDiscoverySourceDto } from './dto/update-discovery-source.dto';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly sources: DiscoverySourcesService,
    private readonly runner: DiscoveryRunnerService,
    private readonly cycle: DiscoveryCycleService,
  ) {}

  @Get('sources')
  findAllSources(@CurrentUser() user: AuthenticatedUser) {
    return this.sources.findAll(user.id);
  }

  @Patch('sources/:sourceKey')
  updateSource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceKey') sourceKey: string,
    @Body() dto: UpdateDiscoverySourceDto,
  ) {
    return this.sources.update(user.id, sourceKey, dto);
  }

  // Synchronous, not enqueued — the queue is the production periodic-
  // schedule path (DiscoverySchedulerService); this lets a user (or a Seam
  // 1 e2e test) force a run and see its recorded outcome in one request,
  // both ultimately going through the same DiscoveryRunnerService.run.
  @Post('sources/:sourceKey/run')
  triggerRun(@CurrentUser() user: AuthenticatedUser, @Param('sourceKey') sourceKey: string) {
    return this.runner.run(user.id, sourceKey);
  }

  @Get('runs')
  findAllRuns(@CurrentUser() user: AuthenticatedUser) {
    return this.sources.findAllRuns(user.id);
  }

  // Runs every registered source in one cycle, isolating each source's
  // failure from the others (ticket 07) — the multi-source counterpart to
  // POST sources/:sourceKey/run.
  @Post('run')
  runAll(@CurrentUser() user: AuthenticatedUser) {
    return this.cycle.runAll(user.id);
  }
}
