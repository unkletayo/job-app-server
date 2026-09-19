import { Injectable } from '@nestjs/common';

/** Shape of a Lever Postings API posting, per
 * https://github.com/lever/postings-api. Only the fields this adapter
 * actually reads — notably, this API has no createdAt/updatedAt field, so
 * there's nothing here to filter incrementally by time. */
export interface LeverPosting {
  id: string;
  text: string;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  hostedUrl?: string;
}

const FETCH_LIMIT = 200;

/**
 * The one place that makes an outbound HTTP call to Lever — kept separate
 * from `LeverAdapter` so tests can override just this boundary with a
 * fixture-serving stub (ticket 08: "not live network calls in CI").
 */
@Injectable()
export class LeverClient {
  async fetchPostings(company: string): Promise<LeverPosting[]> {
    const response = await fetch(
      `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json&limit=${FETCH_LIMIT}`,
    );
    if (!response.ok) {
      throw new Error(`Lever API returned ${response.status} for company "${company}".`);
    }
    return (await response.json()) as LeverPosting[];
  }
}
