import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { GenericFetchAdapter } from './generic-fetch.adapter';
import { SubmitFetchUrlDto } from './dto/submit-fetch-url.dto';

@Controller('job-postings/fetch-url')
@UseGuards(JwtAuthGuard)
export class GenericFetchController {
  constructor(private readonly genericFetchAdapter: GenericFetchAdapter) {}

  // Always 201, whether the fetch succeeded or fell back to
  // needs_manual_paste — the request itself was handled correctly either
  // way; the response body's `status` field discriminates the outcome
  // (same convention as ticket 07's discovery-run endpoints).
  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitFetchUrlDto) {
    return this.genericFetchAdapter.fetchUrl(user.id, dto);
  }
}
