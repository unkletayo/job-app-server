import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { MatchingService } from '../matching/matching.service';
import { JobNormalizationService } from './job-normalization.service';
import { JobPostingsService } from './job-postings.service';

@Controller('job-postings')
@UseGuards(JwtAuthGuard)
export class JobPostingsController {
  constructor(
    private readonly jobPostingsService: JobPostingsService,
    private readonly jobNormalization: JobNormalizationService,
    private readonly matching: MatchingService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.jobPostingsService.findAll(user.id);
  }

  // Synchronous, like discovery's forced run: extraction is deterministic
  // and fast, so the caller sees the outcome in one request.
  @Post('re-extract')
  @HttpCode(HttpStatus.OK)
  reExtract(@CurrentUser() user: AuthenticatedUser) {
    return this.jobNormalization.reExtractAll(user.id);
  }

  // Match Score is computed at view time, not persisted — it's cheap to
  // recompute and always reflects the current Candidate Profile/Job
  // Preferences rather than going stale (per spec story 23: opening a Job
  // Posting's detail view shows its Match Score breakdown and Gaps).
  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const jobPosting = await this.jobPostingsService.findOne(user.id, id);
    const matchScore = await this.matching.score(user.id, jobPosting);
    return { ...jobPosting, matchScore };
  }
}
