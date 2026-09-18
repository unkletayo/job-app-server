import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JobPosting } from '@prisma/client';
import { JobNormalizationService } from '../job-normalization.service';
import { ApplicationCapabilities, JobSourceAdapter, SearchResult } from '../source-adapter';
import { SubmitManualPasteDto } from './dto/submit-manual-paste.dto';

export const MANUAL_PASTE_SOURCE = 'manual_paste';

/**
 * The simplest possible JobSourceAdapter: no network call, ever. The "query"
 * and "id" are both just the fields the user pasted directly — this proves
 * the normalization pipeline (JobNormalizationService) works independent of
 * any source-integration risk, per ticket 04. LinkedIn/Glassdoor postings
 * (0001-source-integration-policy) only ever reach the system through this
 * adapter — never through one that makes a request to those domains.
 */
@Injectable()
export class ManualPasteAdapter
  implements JobSourceAdapter<SubmitManualPasteDto, SubmitManualPasteDto>
{
  constructor(private readonly normalization: JobNormalizationService) {}

  async search(userId: string, query: SubmitManualPasteDto): Promise<SearchResult> {
    const jobPosting = await this.getJob(userId, query);
    return { jobs: [jobPosting], hasMore: false };
  }

  async getJob(userId: string, input: SubmitManualPasteDto): Promise<JobPosting> {
    const sourceJobId = randomUUID();

    const { jobPosting } = await this.normalization.ingest(userId, MANUAL_PASTE_SOURCE, sourceJobId, input, {
      company: input.company,
      title: input.title,
      description: input.description,
      location: input.location ? [input.location] : [],
      remoteType: null,
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      seniority: null,
      skills: [],
      requirements: [],
      preferredQualifications: [],
      educationRequirements: [],
      experienceRequirements: [],
      applicationUrl: input.url ?? null,
      postedAt: null,
      deadline: null,
      sourceUpdatedAt: null,
    });

    return jobPosting;
  }

  supportsApplication(): boolean {
    return false;
  }

  getApplicationCapabilities(): ApplicationCapabilities {
    return { supported: false, requiresManualSubmission: true };
  }

  prepareApplication(): Promise<never> {
    return Promise.reject(
      new Error('ManualPasteAdapter does not support application preparation in this phase.'),
    );
  }
}
