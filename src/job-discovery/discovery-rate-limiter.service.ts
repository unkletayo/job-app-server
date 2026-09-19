import { Injectable } from '@nestjs/common';

/**
 * Per-source request throttling (ticket 07). A plain in-process gate rather
 * than a Redis-shared token bucket — this app runs as a single worker
 * process locally (0002-tech-stack), so there's no second process racing
 * for the same source's budget. Sits in front of every adapter.fetchPage
 * call; the exponential-backoff+jitter half of "throttling + backoff +
 * jitter" lives on the BullMQ job options instead (DiscoveryScheduler),
 * since that's specifically about spacing out *retries after a failure*,
 * not steady-state request pacing.
 */
@Injectable()
export class DiscoveryRateLimiterService {
  private readonly lastRequestAt = new Map<string, number>();

  async wait(sourceKey: string, requestsPerMinute: number): Promise<void> {
    const minIntervalMs = 60_000 / Math.max(requestsPerMinute, 1);
    const last = this.lastRequestAt.get(sourceKey);
    const now = Date.now();

    if (last !== undefined) {
      const elapsed = now - last;
      const remaining = minIntervalMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    }

    this.lastRequestAt.set(sourceKey, Date.now());
  }
}
