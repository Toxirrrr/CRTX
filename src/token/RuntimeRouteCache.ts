/**
 * RuntimeRouteCache — caches capability → runtime routing decisions.
 *
 * Instead of asking the LLM "which runtime should handle security-review?"
 * on every task, we cache the answer for a few hours.
 *
 * Cache key: capability
 * TTL:       configurable (default: 4 hours)
 *
 * Storage: in-memory Map (process lifetime). No disk I/O for route lookups.
 */

export interface RouteDecision {
  capability: string;
  runtime: string;
  provider: string;
  model: string;
  decidedAt: string;
  expiresAt: string;
}

const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export class RuntimeRouteCache {
  private cache = new Map<string, RouteDecision>();

  /** Store a routing decision for a capability. */
  set(capability: string, decision: Omit<RouteDecision, 'capability' | 'decidedAt' | 'expiresAt'>, ttlMs = DEFAULT_TTL_MS): void {
    const now = new Date();
    this.cache.set(capability, {
      ...decision,
      capability,
      decidedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    });
  }

  /** Get a cached routing decision. Returns null if missing or expired. */
  get(capability: string): RouteDecision | null {
    const entry = this.cache.get(capability);
    if (!entry) return null;
    if (new Date(entry.expiresAt).getTime() < Date.now()) {
      this.cache.delete(capability);
      return null;
    }
    return entry;
  }

  /** Invalidate a specific capability's cached route (e.g. runtime went offline). */
  invalidate(capability: string): void {
    this.cache.delete(capability);
  }

  /** Invalidate all routes for a specific runtime (called when runtime goes offline). */
  invalidateRuntime(runtime: string): void {
    for (const [cap, decision] of this.cache.entries()) {
      if (decision.runtime === runtime) {
        this.cache.delete(cap);
      }
    }
  }

  /** Sweep expired entries (call periodically). */
  sweepExpired(): number {
    let evicted = 0;
    const now = Date.now();
    for (const [cap, entry] of this.cache.entries()) {
      if (new Date(entry.expiresAt).getTime() < now) {
        this.cache.delete(cap);
        evicted++;
      }
    }
    return evicted;
  }

  /** Returns a snapshot of all cached routing decisions. */
  snapshot(): RouteDecision[] {
    return Array.from(this.cache.values());
  }
}
