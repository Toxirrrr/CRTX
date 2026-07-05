import { 
    SnapshotStore, PluginStateStore, ScheduleStore, ExecutionStore, 
    RuntimeSnapshot, PluginSnapshot, SchedulerSnapshot, ExecutionRecord 
} from "../../sdk/src/persistence";
import { SQLiteDriver } from "./SQLiteDriver";
import { SnapshotRepository } from "./repositories/SnapshotRepository";
import { PluginStateRepository } from "./repositories/PluginStateRepository";
import { ScheduleRepository } from "./repositories/ScheduleRepository";
import { ExecutionRepository } from "./repositories/ExecutionRepository";

export class SQLiteStorageAdapter implements SnapshotStore, PluginStateStore, ScheduleStore, ExecutionStore {
    constructor(
        private readonly driver: SQLiteDriver,
        private readonly snapshotRepo: SnapshotRepository,
        private readonly pluginRepo: PluginStateRepository,
        private readonly scheduleRepo: ScheduleRepository,
        private readonly executionRepo: ExecutionRepository
    ) {}

    async saveRuntimeSnapshot(snapshot: RuntimeSnapshot): Promise<void> {
        this.driver.transaction(() => {
            this.snapshotRepo.save(snapshot);
            this.scheduleRepo.save(snapshot.scheduler);
            for (const plugin of snapshot.plugins) {
                this.pluginRepo.save(plugin.pluginId, plugin);
            }
        });
    }

    async getLatestRuntimeSnapshot(): Promise<RuntimeSnapshot | null> {
        return this.driver.transaction(() => {
            const plugins = this.pluginRepo.getAll();
            const scheduler = this.scheduleRepo.get() || { pendingCommands: [], scheduledCommands: [], retryState: {} };
            return this.snapshotRepo.getLatest(plugins, scheduler);
        });
    }

    async getRuntimeSnapshot(runtimeId: string): Promise<RuntimeSnapshot | null> {
        return this.driver.transaction(() => {
            const plugins = this.pluginRepo.getAll();
            const scheduler = this.scheduleRepo.get() || { pendingCommands: [], scheduledCommands: [], retryState: {} };
            return this.snapshotRepo.getById(runtimeId, plugins, scheduler);
        });
    }

    async savePluginState(pluginId: string, state: PluginSnapshot): Promise<void> {
        this.driver.transaction(() => {
            this.pluginRepo.save(pluginId, state);
        });
    }

    async getPluginState(pluginId: string): Promise<PluginSnapshot | null> {
        return this.driver.transaction(() => {
            return this.pluginRepo.get(pluginId);
        });
    }

    async saveSchedule(snapshot: SchedulerSnapshot): Promise<void> {
        this.driver.transaction(() => {
            this.scheduleRepo.save(snapshot);
        });
    }

    async getSchedule(): Promise<SchedulerSnapshot | null> {
        return this.driver.transaction(() => {
            return this.scheduleRepo.get();
        });
    }

    async saveExecutionRecord(record: ExecutionRecord): Promise<void> {
        this.driver.transaction(() => {
            this.executionRepo.save(record);
        });
    }

    async getExecutionRecord(commandId: string): Promise<ExecutionRecord | null> {
        return this.driver.transaction(() => {
            return this.executionRepo.get(commandId);
        });
    }

    async dispose(): Promise<void> {
        this.driver.close();
    }
}
