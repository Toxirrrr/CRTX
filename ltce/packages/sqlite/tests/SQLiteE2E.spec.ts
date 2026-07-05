import { describe, it, expect, beforeEach } from 'vitest';
import { SQLiteStorageAdapter } from '../src/SQLiteStorageAdapter';
import { SQLiteDriver } from '../src/SQLiteDriver';
import { SnapshotRepository } from '../src/repositories/SnapshotRepository';
import { PluginStateRepository } from '../src/repositories/PluginStateRepository';
import { ScheduleRepository } from '../src/repositories/ScheduleRepository';
import { ExecutionRepository } from '../src/repositories/ExecutionRepository';
import { SQLiteSerializer } from '../src/SQLiteSerializer';
import { DefaultBootManager, DefaultBootPolicy } from '../../core/src/boot/DefaultBootManager';
import { RuntimeConfiguration } from '../../sdk/src/runtime';

class InMemorySQLiteDriver implements SQLiteDriver {
    public store: Record<string, any[]> = {
        runtime_snapshots: [],
        plugin_snapshots: [],
        scheduler_snapshots: [],
        execution_records: []
    };

    execute(sql: string, params: any[] = []): void {
        if (sql.includes('CREATE TABLE')) return;

        if (sql.includes('INSERT OR REPLACE INTO runtime_snapshots')) {
            this.store.runtime_snapshots = [{ runtime_id: params[0], created_at: params[1], data: params[2] }];
        } else if (sql.includes('INSERT OR REPLACE INTO scheduler_snapshots')) {
            this.store.scheduler_snapshots = [{ id: 1, data: params[0] }];
        } else if (sql.includes('INSERT OR REPLACE INTO plugin_snapshots')) {
            this.store.plugin_snapshots = this.store.plugin_snapshots.filter(p => p.plugin_id !== params[0]);
            this.store.plugin_snapshots.push({ plugin_id: params[0], data: params[1] });
        }
    }

    query<T>(sql: string, params: any[] = []): T[] {
        if (sql.includes('plugin_snapshots')) return this.store.plugin_snapshots as any;
        return [];
    }

    queryOne<T>(sql: string, params: any[] = []): T | null {
        if (sql.includes('runtime_snapshots ORDER BY created_at DESC LIMIT 1')) {
            return this.store.runtime_snapshots[0] || null;
        }
        if (sql.includes('scheduler_snapshots WHERE id = 1')) {
            return this.store.scheduler_snapshots[0] || null;
        }
        return null;
    }

    transaction<T>(action: () => T): T {
        return action();
    }

    close(): void {}
}

describe('SQLite E2E Crash Recovery', () => {
    let driver: InMemorySQLiteDriver;
    let adapter: SQLiteStorageAdapter;
    let bootManager: DefaultBootManager;

    beforeEach(() => {
        driver = new InMemorySQLiteDriver();
        const serializer = new SQLiteSerializer();
        adapter = new SQLiteStorageAdapter(
            driver,
            new SnapshotRepository(driver, serializer),
            new PluginStateRepository(driver, serializer),
            new ScheduleRepository(driver, serializer),
            new ExecutionRepository(driver, serializer)
        );
        bootManager = new DefaultBootManager(new DefaultBootPolicy());
    });

    const createConfig = (): RuntimeConfiguration => ({
        clock: { now: () => new Date() },
        storage: { snapshots: adapter, pluginStates: adapter, schedules: adapter, executions: adapter },
        telemetry: { sink: { record: () => {} } },
        logger: {},
        plugins: []
    });

    it('1. Cold Start - Empty DB', async () => {
        const config = createConfig();
        const decision = await new DefaultBootPolicy().evaluate(config);
        expect(decision.mode).toBe("COLD_START");

        const host = await bootManager.bootstrap(config);
        expect(host).toBeDefined();
    });

    it('2. Graceful Shutdown & Warm Restart', async () => {
        // Setup state mimicking gracefull shutdown
        const baseSnapshot = {
            runtimeId: "run-graceful", createdAt: new Date(),
            version: { major: 1, minor: 0, runtimeVersion: "1.0", schemaVersion: "1.0" },
            health: "OK", metadata: { cleanShutdown: true },
            plugins: [], scheduler: { pendingCommands: [], scheduledCommands: [], retryState: {} }
        };
        await adapter.saveRuntimeSnapshot(baseSnapshot);

        const config = createConfig();
        const decision = await new DefaultBootPolicy().evaluate(config);
        expect(decision.mode).toBe("WARM_START");

        const host = await bootManager.bootstrap(config);
        expect(host).toBeDefined();
    });

    it('3. Crash Recovery - Unclean shutdown', async () => {
        const baseSnapshot = {
            runtimeId: "run-crash", createdAt: new Date(),
            version: { major: 1, minor: 0, runtimeVersion: "1.0", schemaVersion: "1.0" },
            health: "OK", metadata: { cleanShutdown: false },
            plugins: [], scheduler: { pendingCommands: [{ id: 'cmd-x' }], scheduledCommands: [], retryState: {} }
        };
        await adapter.saveRuntimeSnapshot(baseSnapshot);

        const config = createConfig();
        const decision = await new DefaultBootPolicy().evaluate(config);
        expect(decision.mode).toBe("CRASH_RECOVERY");
        expect(decision.shouldRecover).toBe(true);

        const host = await bootManager.bootstrap(config);
        // Recovery runs during bootstrap
        expect(host).toBeDefined();
    });

    it('4. Corrupted DB - Version Mismatch', async () => {
        const baseSnapshot = {
            runtimeId: "run-corrupt", createdAt: new Date(),
            version: { major: 99, minor: 0, runtimeVersion: "99.0", schemaVersion: "99.0" },
            health: "OK", metadata: { cleanShutdown: false },
            plugins: [], scheduler: { pendingCommands: [], scheduledCommands: [], retryState: {} }
        };
        await adapter.saveRuntimeSnapshot(baseSnapshot);

        const config = createConfig();
        await expect(bootManager.bootstrap(config)).rejects.toThrow("Cannot boot");
    });

    it('5. Partial Snapshot Handling', async () => {
        // Insert a runtime snapshot but miss plugin snapshots
        driver.store.runtime_snapshots = [{
            runtime_id: "run-partial",
            created_at: new Date().toISOString(),
            data: JSON.stringify({ version: { major: 1, minor: 0 }, health: "OK", metadata: {} })
        }];
        driver.store.plugin_snapshots = []; // Missing
        
        const config = createConfig();
        const host = await bootManager.bootstrap(config);
        
        // Recover should seamlessly provide empty plugins since they are missing in the repo layer DB
        expect(host).toBeDefined();
    });

    it('6. Recovery Idempotency', async () => {
        const baseSnapshot = {
            runtimeId: "run-idem", createdAt: new Date(),
            version: { major: 1, minor: 0, runtimeVersion: "1.0", schemaVersion: "1.0" },
            health: "OK", metadata: { cleanShutdown: false },
            plugins: [], scheduler: { pendingCommands: [{ id: 'cmd-y' }], scheduledCommands: [], retryState: {} }
        };
        await adapter.saveRuntimeSnapshot(baseSnapshot);

        const config = createConfig();
        const host = await bootManager.bootstrap(config);
        
        // Run recover a second time
        await expect(host.recover()).resolves.toBeUndefined();
    });
});
