/**
 * TaskFingerprint — deduplicates tasks by their semantic content.
 *
 * Key insight: fingerprint must NOT include taskId.
 * Same review on same files should hit the cache even with a new taskId.
 *
 * Hash input: capability + instruction (normalized) + sorted(files) + model + runtime
 * Storage:    memory/fingerprints.json
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const FINGERPRINT_PATH = path.resolve(process.cwd(), 'memory', 'fingerprints.json');

export interface FingerprintEntry {
  fingerprint: string;
  resultId: string;      // points to memory/cache/<resultId>.json
  capability?: string;
  runtime?: string;
  model?: string;
  createdAt: string;
}

export class TaskFingerprint {
  /**
   * Normalize an instruction for semantic fingerprinting.
   * Strips taskIds, timestamps, and filler words so that:
   *   "review auth module"
   *   "review auth module please"
   *   "review auth module now"
   * all produce the same fingerprint.
   */
  static normalize(instruction: string): string {
    return instruction
      .toLowerCase()
      .trim()
      // remove ISO timestamps like "2026-06-13T12:00:00Z" or "2026-06-13"
      .replace(/\d{4}-\d{2}-\d{2}(?:t[\d:.z+-]+)?/gi, '')
      // remove common task IDs like "F24", "B03", "TS-Fixes"
      .replace(/\b[A-Z]{1,3}\d+\b/g, '')
      // remove filler words
      .replace(/\b(please|now|asap|urgent|today|again|re-run)\b/gi, '')
      // collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Compute a 16-char SHA-256 fingerprint.
   * Does NOT include taskId — intentionally cross-task reusable.
   */
  static compute(opts: {
    capability: string;
    instruction: string;
    files?: string[];
    model?: string;
    runtime?: string;
  }): string {
    const normalized = TaskFingerprint.normalize(opts.instruction);
    const content = JSON.stringify({
      capability: opts.capability,
      instruction: normalized,
      files: [...(opts.files ?? [])].sort(),
      model: opts.model ?? '',
      runtime: opts.runtime ?? '',
    });
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /** Check if this fingerprint was already completed. Returns entry or null. */
  static async lookup(fingerprint: string): Promise<FingerprintEntry | null> {
    try {
      const store = JSON.parse(await fsp.readFile(FINGERPRINT_PATH, 'utf8'));
      return store[fingerprint] ?? null;
    } catch {
      return null;
    }
  }

  /** Record a completed fingerprint → resultId mapping. */
  static async record(entry: FingerprintEntry): Promise<void> {
    let store: Record<string, FingerprintEntry> = {};
    try {
      store = JSON.parse(await fsp.readFile(FINGERPRINT_PATH, 'utf8'));
    } catch { /* first write */ }

    store[entry.fingerprint] = entry;

    const tmp = FINGERPRINT_PATH + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(store, null, 2) + '\n', 'utf8');
    await fsp.rename(tmp, FINGERPRINT_PATH);
  }

  /** Remove a fingerprint (e.g. if source files changed). */
  static async invalidate(fingerprint: string): Promise<void> {
    try {
      const store = JSON.parse(await fsp.readFile(FINGERPRINT_PATH, 'utf8'));
      delete store[fingerprint];
      await fsp.writeFile(FINGERPRINT_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
    } catch { /* ignore */ }
  }
}
