import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { JobClustersService } from './job-clusters.service';

@Controller('job-clusters')
@UseGuards(JwtAuthGuard)
export class JobClustersController {
  constructor(private readonly jobClustersService: JobClustersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.jobClustersService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobClustersService.findOne(user.id, id);
  }
}
