/**
 * RuntimeSelector — orchestrates CapabilityResolver + RuntimeRegistry + Adapters.
 *
 * Usage:
 *   const selector = new RuntimeSelector(adapters);
 *   const result = await selector.resolve('security-review', task);
 *
 * The selector picks the highest-weighted online runtime that has a registered adapter.
 * If nothing is available, it falls back to the NullAdapter (returns PARKED).
 */

import { RuntimeAdapter, Task, RuntimeResult } from './RuntimeAdapter';
import { RuntimeRegistry } from './RuntimeRegistry';
import { CapabilityResolver } from './CapabilityResolver';
import { GenericAdapter } from './adapters/GenericAdapter';
import { RuntimeRouteCache } from '../token/RuntimeRouteCache';

export interface SelectionResult {
  runtimeName: string;
  provider: string;
  model: string;
  result: RuntimeResult;
}

export class RuntimeSelector {
  private registry   = new RuntimeRegistry();
  private resolver   = new CapabilityResolver();
  private adapters   = new Map<string, RuntimeAdapter>();
  private routeCache = new RuntimeRouteCache();

  /** Register an adapter. Call once at server startup for each supported runtime. */
  register(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Resolve the best available runtime for a capability and execute the task.
   * Falls back to NullAdapter (PARKED) if no online runtime is found.
   */
  async resolve(capability: string, task: Task): Promise<SelectionResult> {
    // Check route cache first — avoid re-querying on every task
    const cached = this.routeCache.get(capability);
    if (cached) {
      const adapter = this.adapters.get(cached.runtime) ?? new GenericAdapter(cached.runtime);
      const result  = await adapter.execute(task);
      return { runtimeName: cached.runtime, provider: cached.provider, model: cached.model, result };
    }

    const ranked = await this.resolver.resolve(capability);

    for (const name of ranked) {
      if (!(await this.registry.isOnline(name))) continue;

      // Use the registered adapter, or fall back to GenericAdapter for
      // any runtime that exists in runtime_registry.json without a dedicated adapter.
      let adapter = this.adapters.get(name);
      if (!adapter && await this.registry.get(name)) {
        adapter = new GenericAdapter(name);
      }
      if (!adapter) continue;

      const entry = (await this.registry.get(name))!;
      const model = entry.models[0] ?? 'unknown';

      // Cache this routing decision for future tasks with the same capability
      this.routeCache.set(capability, { runtime: name, provider: entry.provider, model });

      const result = await adapter.execute(task);
      return { runtimeName: name, provider: entry.provider, model, result };
    }

    // Nothing available — return PARKED via NullAdapter
    return {
      runtimeName: 'null',
      provider: 'none',
      model: 'none',
      result: {
        success: false,
        runtimeName: 'null',
        error: `No online runtime found for capability "${capability}". Task parked.`,
        executedAt: new Date().toISOString(),
      },
    };
  }

  /** Returns names of all registered adapters. */
  registeredAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }
}
