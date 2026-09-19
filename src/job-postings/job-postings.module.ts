import { Module } from '@nestjs/common';
import { JobPostingsController } from './job-postings.controller';
import { JobPostingsService } from './job-postings.service';
import { JobClustersController } from './job-clusters.controller';
import { JobClustersService } from './job-clusters.service';
import { JobClusterService } from './job-cluster.service';
import { JobNormalizationService } from './job-normalization.service';
import { RequirementExtractionService } from './requirement-extraction.service';
import { ManualPasteController } from './manual-paste/manual-paste.controller';
import { ManualPasteAdapter } from './manual-paste/manual-paste.adapter';

@Module({
  controllers: [JobPostingsController, JobClustersController, ManualPasteController],
  providers: [
    JobPostingsService,
    JobClustersService,
    JobClusterService,
    JobNormalizationService,
    RequirementExtractionService,
    ManualPasteAdapter,
  ],
})
export class JobPostingsModule {}
