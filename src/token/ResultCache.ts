/**
 * ResultCache — caches task results to avoid re-running identical analyses.
 *
 * Cache key: fingerprint + runtime + model
 * NOT taskId — allows cross-task reuse of identical analyses.
 *
 * Only suitable for deterministic tasks:
 *   ✅ security-review, dependency-scan, architecture-review
 *   ❌ implementation, code-generation, planning (code changes break cache)
 *
 * Storage: memory/cache/<fingerprint>_<runtime>_<model>.json
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), 'memory', 'cache');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Capabilities that are safe to cache (deterministic). */
export const CACHEABLE_CAPABILITIES = new Set([
  'security-review',
  'dependency-scan',
  'architecture-review',
  'review',
  'analysis',
]);

export interface CacheEntry<T = unknown> {
  cacheKey: string;
  fingerprint: string;
  runtime: string;
  model: string;
  capability?: string;
  result: T;
  cachedAt: string;
  expiresAt: string;
}

export class ResultCache {
  constructor() {
    // Sync mkdir on instantiation is acceptable as it only happens on startup
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  /** Build the composite cache key from fingerprint + runtime + model. */
  static key(fingerprint: string, runtime: string, model: string): string {
    // Sanitize to be safe as a filename
    return [fingerprint, runtime, model]
      .map(s => s.replace(/[^a-zA-Z0-9-]/g, '_'))
      .join('__');
  }

  /** Returns true if this capability is safe to cache. */
  static isCacheable(capability: string): boolean {
    return CACHEABLE_CAPABILITIES.has(capability);
  }

  /** Store a result in the cache (keyed by fingerprint+runtime+model). */
  async set<T>(opts: {
    fingerprint: string;
    runtime: string;
    model: string;
    capability?: string;
    result: T;
    ttlMs?: number;
  }): Promise<void> {
    const { fingerprint, runtime, model, capability, result, ttlMs = DEFAULT_TTL_MS } = opts;
    const cacheKey = ResultCache.key(fingerprint, runtime, model);
    const now = new Date();

    const entry: CacheEntry<T> = {
      cacheKey,
      fingerprint,
      runtime,
      model,
      capability,
      result,
      cachedAt:  now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };

    const file = path.join(CACHE_DIR, `${cacheKey}.json`);
    const tmp  = file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(entry, null, 2) + '\n', 'utf8');
    await fsp.rename(tmp, file);
  }

  /** Get a cached result. Returns null if missing or expired. */
  async get<T>(fingerprint: string, runtime: string, model: string): Promise<CacheEntry<T> | null> {
    const cacheKey = ResultCache.key(fingerprint, runtime, model);
    const file     = path.join(CACHE_DIR, `${cacheKey}.json`);
    try {
      const entry = JSON.parse(await fsp.readFile(file, 'utf8')) as CacheEntry<T>;
      if (new Date(entry.expiresAt).getTime() < Date.now()) {
        await this.evict(fingerprint, runtime, model);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  /** Evict a single cache entry. */
  async evict(fingerprint: string, runtime: string, model: string): Promise<void> {
    try {
      await fsp.unlink(path.join(CACHE_DIR, `${ResultCache.key(fingerprint, runtime, model)}.json`));
    } catch { /* ignore */ }
  }

  /**
   * Sweep expired entries. Returns number of entries evicted.
   */
  async sweepExpired(): Promise<number> {
    let evicted = 0;
    try {
      const files = (await fsp.readdir(CACHE_DIR)).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const entry = JSON.parse(await fsp.readFile(path.join(CACHE_DIR, file), 'utf8'));
          if (new Date(entry.expiresAt).getTime() < Date.now()) {
            await fsp.unlink(path.join(CACHE_DIR, file));
            evicted++;
          }
        } catch { /* malformed — skip */ }
      }
    } catch { /* cache dir missing — ok */ }
    return evicted;
  }

  /** Returns list of all valid (non-expired) cache entries. */
  async list(): Promise<CacheEntry[]> {
    const entries: CacheEntry[] = [];
    try {
      const files = (await fsp.readdir(CACHE_DIR)).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const entry = JSON.parse(await fsp.readFile(path.join(CACHE_DIR, file), 'utf8'));
          if (new Date(entry.expiresAt).getTime() >= Date.now()) entries.push(entry);
        } catch { /* skip */ }
      }
    } catch { /* ok */ }
    return entries;
  }
}
