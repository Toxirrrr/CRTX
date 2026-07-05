import {
  PluginStateStore,
  RuntimeSnapshot,
  ScheduleStore,
  SnapshotStore
} from "../../../sdk/src/persistence";

export class RecoveryService {
  constructor(
    private readonly snapshotStore: SnapshotStore,
    private readonly pluginStateStore: PluginStateStore,
    private readonly scheduleStore: ScheduleStore
  ) {}

  /**
   * Rebuilds the runtime state by retrieving the latest snapshot and 
   * merging it with the most up-to-date schedule and plugin states.
   */
  async rebuildRuntime(): Promise<RuntimeSnapshot | null> {
    const latestSnapshot = await this.snapshotStore.getLatestRuntimeSnapshot();
    
    if (!latestSnapshot) {
      return null;
    }

    // Rehydrate schedule if it was independently updated
    const latestSchedule = await this.scheduleStore.getSchedule();
    if (latestSchedule) {
      latestSnapshot.scheduler = latestSchedule;
    }

    // Rehydrate individual plugin states if they were independently updated
    for (let i = 0; i < latestSnapshot.plugins.length; i++) {
      const plugin = latestSnapshot.plugins[i];
      const latestPluginState = await this.pluginStateStore.getPluginState(plugin.pluginId);
      if (latestPluginState) {
        latestSnapshot.plugins[i] = latestPluginState;
      }
    }

    return latestSnapshot;
  }
}
