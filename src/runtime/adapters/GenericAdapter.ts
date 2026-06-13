/**
 * GenericAdapter — universal fallback adapter for any runtime registered in
 * runtime_registry.json that does NOT have a dedicated adapter class.
 *
 * How it works:
 *   - Reads the runtime's entry from runtime_registry.json for metadata.
 *   - Reads health from runtime_health.json.
 *   - On execute(): assigns the task to that runtime via filesystem (same as
 *     ClaudeCodeAdapter / AntigravityAdapter), so the listen-for-work daemon
 *     can pick it up if it is running.
 *
 * This means adding a new runtime (e.g. "windsurf", "aider", "codex-cli")
 * requires ONLY:
 *   1. An entry in memory/runtime_registry.json
 *   2. An entry in memory/capability_registry.json
 *   3. Nothing else — no new TypeScript file needed.
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';
import { RuntimeAdapter, RuntimeHealth, RuntimeResult, Task } from '../RuntimeAdapter';

const MEMORY_DIR = path.resolve(process.cwd(), 'memory');

export class GenericAdapter implements RuntimeAdapter {
  readonly name: string;
  readonly provider: string;
  readonly models: string[];
  readonly capabilities: string[];

  constructor(name: string) {
    this.name = name;

    // Read static description from runtime/registry.json
    try {
      const registryPath = path.join(process.cwd(), 'runtime', 'registry.json');
      const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      let entry: any = {};
      
      if (Array.isArray(raw.runtimes)) {
        entry = raw.runtimes.find((r: any) => r.id === name) ?? {};
      } else {
        entry = raw[name] ?? {};
      }
      
      this.provider     = entry.provider     ?? 'unknown';
      this.models       = entry.models       ?? [];
      this.capabilities = entry.capabilities ?? [];
    } catch {
      this.provider     = 'unknown';
      this.models       = [];
      this.capabilities = [];
    }
  }

  async health(): Promise<RuntimeHealth> {
    try {
      const data  = JSON.parse(await fsp.readFile(path.join(MEMORY_DIR, 'runtime_health.json'), 'utf8'));
      const entry = data.agents?.[this.name] ?? data[this.name];
      const online = entry?.status === 'online' || entry?.online === true;
      return { online, lastCheckedAt: entry?.lastSeen ?? new Date().toISOString() };
    } catch {
      return { online: false, lastCheckedAt: new Date().toISOString() };
    }
  }

  async execute(task: Task): Promise<RuntimeResult> {
    const taskPath = path.resolve(process.cwd(), 'tasks', `${task.id}.json`);
    try {
      let existing: any;
      try {
        await fsp.access(taskPath);
        existing = JSON.parse(await fsp.readFile(taskPath, 'utf8'));
      } catch {
        existing = { ...task };
      }

      existing.owner     = this.name;
      existing.status    = 'assigned';
      existing.updatedAt = new Date().toISOString();

      await fsp.writeFile(taskPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

      return {
        success: true,
        runtimeName: this.name,
        output: `[GenericAdapter] Task "${task.id}" assigned to runtime "${this.name}" (${this.provider}). Listener will pick it up.`,
        executedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        success: false,
        runtimeName: this.name,
        error: `[GenericAdapter] Failed to assign task "${task.id}" to "${this.name}": ${(e as Error).message}`,
        executedAt: new Date().toISOString(),
      };
    }
  }
}
