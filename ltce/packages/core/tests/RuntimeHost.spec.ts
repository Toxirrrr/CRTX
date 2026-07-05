import { describe, it, expect, vi } from 'vitest';
import { RuntimeHost } from '../src/runtime/RuntimeHost';
import { RuntimeConfiguration } from '../../sdk/src/runtime';
import { MemoryStorage } from '../src/persistence/MemoryStorage';

describe('RuntimeHost Lifecycle', () => {
  it('should initialize and compose core components without error', () => {
    const memoryStore = new MemoryStorage();
    const config: RuntimeConfiguration = {
      clock: { now: () => new Date() },
      storage: {
        snapshots: memoryStore,
        pluginStates: memoryStore,
        schedules: memoryStore,
        executions: memoryStore
      },
      telemetry: { sink: { record: vi.fn() } },
      logger: {},
      plugins: []
    };

    const host = new RuntimeHost(config);
    expect(host.getOrchestrator()).toBeDefined();
    expect(host.getPlanner()).toBeDefined();
    expect(host.getCatalog()).toBeDefined();
  });

  it('should execute full lifecycle correctly', async () => {
    const memoryStore = new MemoryStorage();
    const config: RuntimeConfiguration = {
      clock: { now: () => new Date() },
      storage: {
        snapshots: memoryStore,
        pluginStates: memoryStore,
        schedules: memoryStore,
        executions: memoryStore
      },
      telemetry: { sink: { record: vi.fn() } },
      logger: {},
      plugins: []
    };

    const host = new RuntimeHost(config);

    // Spy on internal parts if possible, or just ensure no throws
    await expect(host.initialize()).resolves.toBeUndefined();
    await expect(host.recover()).resolves.toBeUndefined();
    await expect(host.start()).resolves.toBeUndefined();
    await expect(host.stop()).resolves.toBeUndefined();
    await expect(host.dispose()).resolves.toBeUndefined();
  });
});
