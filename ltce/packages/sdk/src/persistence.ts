export interface PluginSnapshot {
    pluginId: string;
    state: Record<string, any>;
    health: string;
    version: string;
    metadata: Record<string, any>;
}

export interface SchedulerSnapshot {
    pendingCommands: any[];
    scheduledCommands: any[];
    retryState: Record<string, any>;
}

export interface SnapshotVersion {
    major: number;
    minor: number;
    runtimeVersion: string;
    schemaVersion: string;
}

export interface RuntimeSnapshot {
    runtimeId: string;
    createdAt: Date;
    version: SnapshotVersion;
    plugins: PluginSnapshot[];
    scheduler: SchedulerSnapshot;
    health: string;
    metadata: Record<string, any>;
}

export interface ExecutionRecord {
    commandId: string;
    startedAt: Date;
    finishedAt?: Date;
    result?: any;
    error?: string;
}

export interface SnapshotStore {
    saveRuntimeSnapshot(snapshot: RuntimeSnapshot): Promise<void>;
    getLatestRuntimeSnapshot(): Promise<RuntimeSnapshot | null>;
    getRuntimeSnapshot(runtimeId: string): Promise<RuntimeSnapshot | null>;
}

export interface PluginStateStore {
    savePluginState(pluginId: string, state: PluginSnapshot): Promise<void>;
    getPluginState(pluginId: string): Promise<PluginSnapshot | null>;
}

export interface ScheduleStore {
    saveSchedule(snapshot: SchedulerSnapshot): Promise<void>;
    getSchedule(): Promise<SchedulerSnapshot | null>;
}

export interface ExecutionStore {
    saveExecutionRecord(record: ExecutionRecord): Promise<void>;
    getExecutionRecord(commandId: string): Promise<ExecutionRecord | null>;
}
