import {
  DiscoverableSourceAdapter,
  DiscoveryCheckpoint,
  DiscoveryPage,
  DiscoveredPosting,
} from '../../src/job-discovery/discoverable-source-adapter';

const PAGE_SIZE = 2;

function job(index: number): DiscoveredPosting {
  const id = `fake-job-${index}`;
  return {
    reference: { source: 'fake', sourceJobId: id },
    rawData: { id },
    normalized: {
      company: `Fake Co ${index}`,
      title: `Fake Engineer ${index}`,
      description: `Requirements:\n${index}+ years of experience with backend development.`,
      location: ['Remote'],
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
      applicationUrl: null,
      postedAt: null,
      deadline: null,
      sourceUpdatedAt: null,
    },
  };
}

/**
 * Seam 2 test double for `DiscoverableSourceAdapter` (ticket 07) — stands in
 * for a real Sanctioned Source. Filters against `checkpoint.lastSeenJobId`
 * exactly like a real adapter would, and paginates in pages of
 * `PAGE_SIZE` so a run against a fresh checkpoint exercises the runner's
 * multi-page loop, not just a single fetchPage call.
 */
export class FakeSourceAdapter implements DiscoverableSourceAdapter {
  readonly sourceKey = 'fake';

  constructor(private readonly totalJobs: number) {}

  async fetchPage(_userId: string, checkpoint: DiscoveryCheckpoint): Promise<DiscoveryPage> {
    const allJobs = Array.from({ length: this.totalJobs }, (_, i) => job(i + 1));

    let startIndex: number;
    if (checkpoint.cursor !== null) {
      startIndex = Number(checkpoint.cursor);
    } else if (checkpoint.lastSeenJobId) {
      const seenIndex = allJobs.findIndex(
        (j) => j.reference.sourceJobId === checkpoint.lastSeenJobId,
      );
      startIndex = seenIndex + 1;
    } else {
      startIndex = 0;
    }

    const postings = allJobs.slice(startIndex, startIndex + PAGE_SIZE);
    const nextIndex = startIndex + postings.length;
    const hasMore = nextIndex < allJobs.length;

    return {
      postings,
      nextCheckpoint: {
        cursor: hasMore ? String(nextIndex) : null,
        lastSeenJobId: postings.length
          ? postings[postings.length - 1].reference.sourceJobId
          : checkpoint.lastSeenJobId,
      },
      hasMore,
    };
  }
}

/** Simulates a source whose adapter is broken (ticket 07's failure-
 * isolation criterion) — every call fails, never returns a page. */
export class FailingSourceAdapter implements DiscoverableSourceAdapter {
  readonly sourceKey = 'failing';

  async fetchPage(): Promise<DiscoveryPage> {
    throw new Error('FailingSourceAdapter: simulated adapter outage.');
  }
}
