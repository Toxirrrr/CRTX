/**
 * NullAdapter — fallback adapter when no runtime is available.
 * Always returns a PARKED result. Never throws.
 */

import { RuntimeAdapter, RuntimeHealth, RuntimeResult, Task } from '../RuntimeAdapter';

export class NullAdapter implements RuntimeAdapter {
  readonly name        = 'null';
  readonly provider    = 'none';
  readonly models      = [];
  readonly capabilities = [];

  async health(): Promise<RuntimeHealth> {
    return { online: false, lastCheckedAt: new Date().toISOString() };
  }

  async execute(task: Task): Promise<RuntimeResult> {
    return {
      success: false,
      runtimeName: this.name,
      error: `NullAdapter: no runtime available for task "${task.id ?? 'unknown'}". Status set to PARKED.`,
      executedAt: new Date().toISOString(),
    };
  }
}
