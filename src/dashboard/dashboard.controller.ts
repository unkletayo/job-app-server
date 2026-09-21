import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // Also the "high-match" view: ?minScore=70 is the whole difference — one
  // parameterized endpoint rather than two near-duplicate ones.
  @Get('jobs')
  listJobs(@CurrentUser() user: AuthenticatedUser, @Query() query: ListJobsQueryDto) {
    return this.dashboard.listJobs(user.id, { minScore: query.minScore });
  }
}
