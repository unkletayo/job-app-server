import { NormalizedJobFields, SourceReference } from '../job-postings/source-adapter';

/** Where a source's next fetch should resume from — persisted on
 * `DiscoverySource` between runs so a source is never re-polled from
 * scratch. Opaque to the scheduler; only the adapter that produced it knows
 * how to interpret `cursor` (a page token, a timestamp, whatever that
 * source's API uses). */
export interface DiscoveryCheckpoint {
  cursor: string | null;
  lastSeenJobId: string | null;
}

export interface DiscoveredPosting {
  reference: SourceReference;
  rawData: object;
  normalized: NormalizedJobFields;
}

export interface DiscoveryPage {
  postings: DiscoveredPosting[];
  nextCheckpoint: DiscoveryCheckpoint;
  hasMore: boolean;
}

/**
 * The scheduled-discovery contract (ticket 07) — deliberately separate from
 * `JobSourceAdapter` (job-postings/source-adapter.ts), which models a single
 * user-triggered search/apply flow. Only Sanctioned Source adapters
 * (Greenhouse/Lever/Ashby/SmartRecruiters, ticket 08+) implement this one;
 * `ManualPasteAdapter` and `GenericFetchAdapter` are never scheduled, so
 * they never need to. The adapter alone knows how its source's pagination
 * and "since last checkpoint" filtering works — it returns only what's new,
 * the scheduler just persists whatever checkpoint it hands back.
 */
export interface DiscoverableSourceAdapter {
  readonly sourceKey: string;
  fetchPage(userId: string, checkpoint: DiscoveryCheckpoint): Promise<DiscoveryPage>;
}

/** DI token for the registry of scheduled sources, keyed by `sourceKey`.
 * Empty by default (`JobDiscoveryModule`) — real adapters register into it
 * as tickets 08+ land; tests override it with a fake. */
export const DISCOVERY_ADAPTERS = Symbol('DISCOVERY_ADAPTERS');

export type DiscoveryAdapterRegistry = Record<string, DiscoverableSourceAdapter>;
