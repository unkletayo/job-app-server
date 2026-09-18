import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { CandidateProfileService } from './candidate-profile.service';
import { UpsertCandidateProfileDto } from './dto/upsert-candidate-profile.dto';

@Controller('candidate-profile')
@UseGuards(JwtAuthGuard)
export class CandidateProfileController {
  constructor(private readonly candidateProfileService: CandidateProfileService) {}

  @Get()
  findOne(@CurrentUser() user: AuthenticatedUser) {
    return this.candidateProfileService.findOne(user.id);
  }

  @Put()
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCandidateProfileDto) {
    return this.candidateProfileService.upsert(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.candidateProfileService.remove(user.id);
  }
}
