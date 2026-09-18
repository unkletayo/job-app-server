import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { ManualPasteAdapter } from './manual-paste.adapter';
import { SubmitManualPasteDto } from './dto/submit-manual-paste.dto';

@Controller('job-postings/manual-paste')
@UseGuards(JwtAuthGuard)
export class ManualPasteController {
  constructor(private readonly manualPasteAdapter: ManualPasteAdapter) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitManualPasteDto) {
    return this.manualPasteAdapter.getJob(user.id, dto);
  }
}
