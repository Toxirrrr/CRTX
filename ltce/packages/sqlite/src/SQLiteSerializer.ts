import { RuntimeSnapshot, PluginSnapshot, SchedulerSnapshot, ExecutionRecord, SnapshotVersion } from "../../sdk/src/persistence";

export class SQLiteSerializer {
    serializeRuntimeSnapshot(snapshot: RuntimeSnapshot): string {
        return JSON.stringify({
            version: snapshot.version,
            health: snapshot.health,
            metadata: snapshot.metadata
        });
    }

    deserializeRuntimeSnapshot(id: string, createdAt: string, dataStr: string, plugins: PluginSnapshot[], scheduler: SchedulerSnapshot): RuntimeSnapshot {
        const data = JSON.parse(dataStr);
        return {
            runtimeId: id,
            createdAt: new Date(createdAt),
            version: data.version,
            health: data.health,
            metadata: data.metadata,
            plugins,
            scheduler
        };
    }

    serializePluginState(state: PluginSnapshot): string {
        return JSON.stringify({
            state: state.state,
            health: state.health,
            version: state.version,
            metadata: state.metadata
        });
    }

    deserializePluginState(id: string, dataStr: string): PluginSnapshot {
        const data = JSON.parse(dataStr);
        return {
            pluginId: id,
            state: data.state,
            health: data.health,
            version: data.version,
            metadata: data.metadata
        };
    }

    serializeSchedule(schedule: SchedulerSnapshot): string {
        return JSON.stringify(schedule);
    }

    deserializeSchedule(dataStr: string): SchedulerSnapshot {
        return JSON.parse(dataStr);
    }

    serializeExecutionResult(result: any): string | null {
        return result ? JSON.stringify(result) : null;
    }

    deserializeExecutionResult(dataStr: string | null): any {
        return dataStr ? JSON.parse(dataStr) : undefined;
    }
}
