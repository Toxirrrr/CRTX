/**
 * ClaudeCodeAdapter — stub adapter for the Claude Code (Anthropic) runtime.
 *
 * In a future version, execute() would invoke the `claude` CLI subprocess:
 *   claude --task <id> --instruction "<...>"
 *
 * For now, it assigns the task to "claude" in the filesystem so the
 * listen-for-work daemon picks it up normally.
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';
import { RuntimeAdapter, RuntimeHealth, RuntimeResult, Task } from '../RuntimeAdapter';

export class ClaudeCodeAdapter implements RuntimeAdapter {
  readonly name         = 'claude-code';
  readonly provider     = 'anthropic';
  readonly models       = ['claude-sonnet-4-6', 'claude-opus-4-8'];
  readonly capabilities = ['coding', 'security-review', 'architecture', 'review'];

  private healthPath = path.resolve(process.cwd(), 'memory', 'runtime_health.json');

  async health(): Promise<RuntimeHealth> {
    try {
      const data = JSON.parse(await fsp.readFile(this.healthPath, 'utf8'));
      // claude-code maps to "claude" in the existing health file
      const entry = data.agents?.claude ?? data['claude-code'];
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
      existing.owner     = 'claude';
      existing.status    = 'assigned';
      existing.updatedAt = new Date().toISOString();
      await fsp.writeFile(taskPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    } catch (e) {
      return {
        success: false,
        runtimeName: this.name,
        error: `ClaudeCodeAdapter: failed to assign task "${task.id}": ${(e as Error).message}`,
        executedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      runtimeName: this.name,
      output: `Task "${task.id}" assigned to Claude Code runtime. Listener will pick it up.`,
      executedAt: new Date().toISOString(),
    };
  }
}
