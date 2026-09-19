import { Injectable } from '@nestjs/common';

/** Shape of a SmartRecruiters Posting API list-result item, per
 * https://developers.smartrecruiters.com/reference/v1listpostings-1
 * (verified live against api.smartrecruiters.com). The list endpoint
 * doesn't include description content — that requires a second, per-
 * posting call (see `fetchPosting`). */
export interface SmartRecruitersPostingSummary {
  id: string;
  name: string;
  releasedDate: string;
  location?: { fullLocation?: string; city?: string; remote?: boolean };
  typeOfEmployment?: { label: string };
}

interface SmartRecruitersListResponse {
  offset: number;
  limit: number;
  totalFound: number;
  content: SmartRecruitersPostingSummary[];
}

export interface SmartRecruitersPostingDetail {
  applyUrl?: string;
  postingUrl?: string;
  jobAd?: {
    sections?: Record<string, { title: string; text: string } | undefined>;
  };
}

const LIST_LIMIT = 100;

/**
 * The one place that makes outbound HTTP calls to SmartRecruiters — kept
 * separate from `SmartRecruitersAdapter` so tests can override just this
 * boundary with a fixture-serving stub (ticket 09: "not live network calls
 * in CI"). Two endpoints, matching the real API's shape: a list call to
 * enumerate postings, and a per-posting detail call for description
 * content, which the list response doesn't carry.
 */
@Injectable()
export class SmartRecruitersClient {
  async listPostings(companyIdentifier: string): Promise<SmartRecruitersPostingSummary[]> {
    const response = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyIdentifier)}/postings?limit=${LIST_LIMIT}`,
    );
    if (!response.ok) {
      throw new Error(
        `SmartRecruiters API returned ${response.status} for company "${companyIdentifier}".`,
      );
    }
    const data = (await response.json()) as SmartRecruitersListResponse;
    return data.content;
  }

  async fetchPosting(
    companyIdentifier: string,
    postingId: string,
  ): Promise<SmartRecruitersPostingDetail> {
    const response = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyIdentifier)}/postings/${encodeURIComponent(postingId)}`,
    );
    if (!response.ok) {
      throw new Error(
        `SmartRecruiters API returned ${response.status} for posting "${postingId}" (company "${companyIdentifier}").`,
      );
    }
    return (await response.json()) as SmartRecruitersPostingDetail;
  }
}
