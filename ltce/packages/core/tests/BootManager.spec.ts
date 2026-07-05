import { describe, it, expect } from 'vitest';
import { DefaultBootManager, DefaultBootPolicy } from '../src/boot/DefaultBootManager';
import { MemoryStorage } from '../src/persistence/MemoryStorage';
import { RuntimeConfiguration } from '../../sdk/src/runtime';

describe('BootManager and BootPolicy', () => {
    it('should determine COLD_START for empty storage', async () => {
        const policy = new DefaultBootPolicy();
        const store = new MemoryStorage();
        const config = { storage: { snapshots: store } } as RuntimeConfiguration;
        
        const decision = await policy.evaluate(config);
        expect(decision.mode).toBe("COLD_START");
        expect(decision.shouldRecover).toBe(false);
    });

    it('should determine INCOMPATIBLE_VERSION if snapshot is newer', async () => {
        const policy = new DefaultBootPolicy();
        const store = new MemoryStorage();
        await store.saveRuntimeSnapshot({
            runtimeId: "r1", createdAt: new Date(),
            version: { major: 2, minor: 0, runtimeVersion: "2.0", schemaVersion: "2.0" },
            health: "OK", metadata: {}, plugins: [], scheduler: { pendingCommands: [], scheduledCommands: [], retryState: {} }
        });
        const config = { storage: { snapshots: store } } as RuntimeConfiguration;
        
        const decision = await policy.evaluate(config);
        expect(decision.mode).toBe("INCOMPATIBLE_VERSION");
        expect(decision.shouldRecover).toBe(false);
    });

    it('should determine CRASH_RECOVERY if shutdown was unclean', async () => {
        const policy = new DefaultBootPolicy();
        const store = new MemoryStorage();
        await store.saveRuntimeSnapshot({
            runtimeId: "r1", createdAt: new Date(),
            version: { major: 1, minor: 0, runtimeVersion: "1.0", schemaVersion: "1.0" },
            health: "OK", metadata: { cleanShutdown: false }, plugins: [], scheduler: { pendingCommands: [], scheduledCommands: [], retryState: {} }
        });
        const config = { storage: { snapshots: store } } as RuntimeConfiguration;
        
        const decision = await policy.evaluate(config);
        expect(decision.mode).toBe("CRASH_RECOVERY");
        expect(decision.shouldRecover).toBe(true);
    });

    it('should throw via BootManager for INCOMPATIBLE_VERSION', async () => {
        const policy = new DefaultBootPolicy();
        const store = new MemoryStorage();
        await store.saveRuntimeSnapshot({
            runtimeId: "r1", createdAt: new Date(),
            version: { major: 2, minor: 0, runtimeVersion: "2.0", schemaVersion: "2.0" },
            health: "OK", metadata: {}, plugins: [], scheduler: { pendingCommands: [], scheduledCommands: [], retryState: {} }
        });
        const config = { storage: { snapshots: store } } as RuntimeConfiguration;
        
        const bootManager = new DefaultBootManager(policy);
        await expect(bootManager.bootstrap(config)).rejects.toThrow("Cannot boot:");
    });
});
