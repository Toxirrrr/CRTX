/**
 * AntigravityAdapter — stub adapter for the Antigravity (Google Gemini) runtime.
 *
 * In a future version, execute() would:
 *   - Submit the task to the Antigravity IDE API
 *   - Poll for completion
 *   - Return the result
 *
 * For now, it logs the task and marks it as assigned so the human (or PM2 process)
 * can pick it up via the normal listen-for-work flow.
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';
import { RuntimeAdapter, RuntimeHealth, RuntimeResult, Task } from '../RuntimeAdapter';

export class AntigravityAdapter implements RuntimeAdapter {
  readonly name         = 'antigravity';
  readonly provider     = 'google';
  readonly models       = ['gemini-pro', 'gemini-flash'];
  readonly capabilities = ['coding', 'analysis', 'review'];

  private healthPath = path.resolve(process.cwd(), 'memory', 'runtime_health.json');

  async health(): Promise<RuntimeHealth> {
    try {
      const data = JSON.parse(await fsp.readFile(this.healthPath, 'utf8'));
      const entry = data.agents?.antigravity ?? data.antigravity;
      const online = entry?.status === 'online' || entry?.online === true;
      return { online, lastCheckedAt: entry?.lastSeen ?? new Date().toISOString() };
    } catch {
      return { online: false, lastCheckedAt: new Date().toISOString() };
    }
  }

  async execute(task: Task): Promise<RuntimeResult> {
    // Stub: write the task to the tasks/ directory for the listener to pick up
    const taskPath = path.resolve(process.cwd(), 'tasks', `${task.id}.json`);
    try {
      let existing: any;
      try {
        await fsp.access(taskPath);
        existing = JSON.parse(await fsp.readFile(taskPath, 'utf8'));
      } catch {
        existing = { ...task };
      }
      existing.owner     = 'antigravity';
      existing.status    = 'assigned';
      existing.updatedAt = new Date().toISOString();
      await fsp.writeFile(taskPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    } catch (e) {
      return {
        success: false,
        runtimeName: this.name,
        error: `AntigravityAdapter: failed to assign task "${task.id}": ${(e as Error).message}`,
        executedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      runtimeName: this.name,
      output: `Task "${task.id}" assigned to Antigravity runtime. Listener will pick it up.`,
      executedAt: new Date().toISOString(),
    };
  }
}
