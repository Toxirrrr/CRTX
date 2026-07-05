import { Scheduler } from "./scheduler";
import { Orchestrator } from "./orchestration";
import { SnapshotStore, PluginStateStore, ScheduleStore, ExecutionStore } from "./persistence";
import { Clock } from "./context";

export interface StorageConfiguration {
    snapshots: SnapshotStore;
    pluginStates: PluginStateStore;
    schedules: ScheduleStore;
    executions: ExecutionStore;
    dispose?(): Promise<void>;
}

export interface TelemetryConfiguration {
    sink: any; // Or specific TelemetrySink if defined
}

export interface RuntimeConfiguration {
    clock: Clock;
    storage: StorageConfiguration;
    telemetry: TelemetryConfiguration;
    scheduler: Scheduler;
    orchestrator: Orchestrator;
    logger: any; // Or generic Logger interface
    plugins: string[]; // Paths or IDs of plugins to load
}

export interface RuntimeHost {
    initialize(): Promise<void>;
    recover(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
}
