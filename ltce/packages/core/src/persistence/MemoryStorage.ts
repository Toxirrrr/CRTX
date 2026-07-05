import {
  ExecutionRecord,
  ExecutionStore,
  PluginSnapshot,
  PluginStateStore,
  RuntimeSnapshot,
  ScheduleStore,
  SchedulerSnapshot,
  SnapshotStore
} from "../../../sdk/src/persistence";

export class MemoryStorage implements SnapshotStore, PluginStateStore, ScheduleStore, ExecutionStore {
  private runtimeSnapshots = new Map<string, RuntimeSnapshot>();
  private pluginStates = new Map<string, PluginSnapshot>();
  private schedule: SchedulerSnapshot | null = null;
  private executions = new Map<string, ExecutionRecord>();
  private latestRuntimeId: string | null = null;

  async saveRuntimeSnapshot(snapshot: RuntimeSnapshot): Promise<void> {
    this.runtimeSnapshots.set(snapshot.runtimeId, snapshot);
    this.latestRuntimeId = snapshot.runtimeId;
  }

  async getLatestRuntimeSnapshot(): Promise<RuntimeSnapshot | null> {
    if (!this.latestRuntimeId) return null;
    return this.runtimeSnapshots.get(this.latestRuntimeId) || null;
  }

  async getRuntimeSnapshot(runtimeId: string): Promise<RuntimeSnapshot | null> {
    return this.runtimeSnapshots.get(runtimeId) || null;
  }

  async savePluginState(pluginId: string, state: PluginSnapshot): Promise<void> {
    this.pluginStates.set(pluginId, state);
  }

  async getPluginState(pluginId: string): Promise<PluginSnapshot | null> {
    return this.pluginStates.get(pluginId) || null;
  }

  async saveSchedule(snapshot: SchedulerSnapshot): Promise<void> {
    this.schedule = snapshot;
  }

  async getSchedule(): Promise<SchedulerSnapshot | null> {
    return this.schedule;
  }

  async saveExecutionRecord(record: ExecutionRecord): Promise<void> {
    this.executions.set(record.commandId, record);
  }

  async getExecutionRecord(commandId: string): Promise<ExecutionRecord | null> {
    return this.executions.get(commandId) || null;
  }
}
