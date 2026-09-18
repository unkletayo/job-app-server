import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { JobPreferencesService } from './job-preferences.service';
import { UpdateJobPreferencesDto } from './dto/update-job-preferences.dto';

@Controller('job-preferences')
@UseGuards(JwtAuthGuard)
export class JobPreferencesController {
  constructor(private readonly jobPreferencesService: JobPreferencesService) {}

  @Get()
  findOne(@CurrentUser() user: AuthenticatedUser) {
    return this.jobPreferencesService.findOne(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateJobPreferencesDto) {
    return this.jobPreferencesService.update(user.id, dto);
  }
}
