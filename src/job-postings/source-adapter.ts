import { JobPosting } from '@prisma/client';

/** The canonical fields normalization produces, per PRD §9. Not every source
 * can populate every field — adapters set what they know, leave the rest
 * null/empty rather than guess (PRD §5: never invent). */
export interface NormalizedJobFields {
  company: string;
  title: string;
  description: string;
  location: string[];
  remoteType: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  seniority: string | null;
  skills: string[];
  requirements: string[];
  preferredQualifications: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  applicationUrl: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  sourceUpdatedAt: Date | null;
}

/** Identifies which source a posting came from and its id within that
 * source. Travels together everywhere a posting is created or looked up —
 * given its own type rather than two loose strings. */
export interface SourceReference {
  source: string;
  sourceJobId: string;
}

export interface SearchResult {
  jobs: JobPosting[];
  hasMore: boolean;
}

export interface ApplicationCapabilities {
  supported: boolean;
  requiresManualSubmission: boolean;
}

/**
 * Per PRD §7 — the interface every job source implements. The core
 * application never contains site-specific logic; that all lives inside an
 * adapter. `userId` is passed explicitly (not folded into TQuery/TIdentifier)
 * since it's the acting user's context, not part of the job data itself —
 * every adapter runs on behalf of a specific user, even a scheduled one
 * (ticket 07+).
 */
export interface JobSourceAdapter<TQuery, TIdentifier> {
  search(userId: string, query: TQuery): Promise<SearchResult>;
  getJob(userId: string, id: TIdentifier): Promise<JobPosting>;
  supportsApplication(): boolean;
  getApplicationCapabilities(): ApplicationCapabilities;
  prepareApplication(userId: string, job: JobPosting, candidateProfileId: string): Promise<never>;
}
