import { Module } from '@nestjs/common';
import { JobPostingsController } from './job-postings.controller';
import { JobPostingsService } from './job-postings.service';
import { JobNormalizationService } from './job-normalization.service';
import { ManualPasteController } from './manual-paste/manual-paste.controller';
import { ManualPasteAdapter } from './manual-paste/manual-paste.adapter';

@Module({
  controllers: [JobPostingsController, ManualPasteController],
  providers: [JobPostingsService, JobNormalizationService, ManualPasteAdapter],
})
export class JobPostingsModule {}
