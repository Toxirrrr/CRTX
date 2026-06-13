/**
 * CapabilityResolver — resolves a capability string to a ranked list of runtime names.
 *
 * Reads memory/capability_registry.json (weighted map) and returns runtimes
 * sorted by weight descending.
 *
 * Example capability_registry.json:
 * {
 *   "coding": { "claude-code": 100, "cursor": 80, "antigravity": 70 }
 * }
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';

const CAPABILITY_PATH = path.resolve(process.cwd(), 'memory', 'capability_registry.json');

export class CapabilityResolver {
  /**
   * Returns runtime names ranked by weight for the given capability.
   * Returns empty array if the capability is unknown.
   */
  async resolve(capability: string): Promise<string[]> {
    const registry = await this.read();
    return registry[capability] ?? [];
  }

  /** Returns all known capabilities. */
  async capabilities(): Promise<string[]> {
    return Object.keys(await this.read());
  }

  private async read(): Promise<Record<string, string[]>> {
    try {
      const registryPath = path.join(process.cwd(), 'runtime', 'registry.json');
      const raw = JSON.parse(await fsp.readFile(registryPath, 'utf8'));
      const routing = raw.capabilityRouting ?? {};
      
      const result: Record<string, string[]> = {};
      for (const [cap, data] of Object.entries(routing)) {
        result[cap] = (data as any).preferred ?? [];
      }
      return result;
    } catch {
      return {};
    }
  }
}
