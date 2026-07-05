import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from "../src/persistence/MemoryStorage";
import { RecoveryService } from "../src/persistence/RecoveryService";
import { RuntimeSnapshot, PluginSnapshot, SchedulerSnapshot, ExecutionRecord } from "../../sdk/src/persistence";

describe("Persistence Abstraction Layer", () => {
  let storage: MemoryStorage;
  let recoveryService: RecoveryService;

  beforeEach(() => {
    storage = new MemoryStorage();
    recoveryService = new RecoveryService(storage, storage, storage);
  });

  describe("MemoryStorage", () => {
    it("should save and retrieve execution records", async () => {
      const record: ExecutionRecord = {
        commandId: "cmd-1",
        startedAt: new Date(),
        result: { success: true }
      };

      await storage.saveExecutionRecord(record);
      const retrieved = await storage.getExecutionRecord("cmd-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.commandId).toBe("cmd-1");
      expect(retrieved?.result.success).toBe(true);
    });

    it("should return null for non-existent execution record", async () => {
      const retrieved = await storage.getExecutionRecord("non-existent");
      expect(retrieved).toBeNull();
    });

    it("should return null for latest snapshot if none exists", async () => {
      const retrieved = await storage.getLatestRuntimeSnapshot();
      expect(retrieved).toBeNull();
    });
  });

  describe("RecoveryService", () => {
    it("should return null if no snapshot exists", async () => {
      const snapshot = await recoveryService.rebuildRuntime();
      expect(snapshot).toBeNull();
    });

    it("should rebuild runtime from snapshot and independent stores", async () => {
      const baseSchedule: SchedulerSnapshot = {
        pendingCommands: [],
        scheduledCommands: [],
        retryState: {}
      };

      const basePlugin: PluginSnapshot = {
        pluginId: "plugin-1",
        state: { count: 0 },
        health: "ONLINE",
        version: "1.0.0",
        metadata: {}
      };

      const baseSnapshot: RuntimeSnapshot = {
        runtimeId: "run-1",
        createdAt: new Date(),
        version: { major: 1, minor: 0, runtimeVersion: "1.0", schemaVersion: "1.0" },
        health: "OK",
        metadata: {},
        scheduler: baseSchedule,
        plugins: [basePlugin]
      };

      // 1. Save base snapshot
      await storage.saveRuntimeSnapshot(baseSnapshot);

      // 2. Independently update schedule
      const updatedSchedule: SchedulerSnapshot = {
        pendingCommands: [{ id: "cmd-2" }],
        scheduledCommands: [],
        retryState: {}
      };
      await storage.saveSchedule(updatedSchedule);

      // 3. Independently update plugin state
      const updatedPlugin: PluginSnapshot = {
        ...basePlugin,
        state: { count: 5 }
      };
      await storage.savePluginState("plugin-1", updatedPlugin);

      // 4. Rebuild
      const rebuilt = await recoveryService.rebuildRuntime();

      expect(rebuilt).toBeDefined();
      expect(rebuilt?.runtimeId).toBe("run-1");
      
      // Should have merged the schedule
      expect(rebuilt?.scheduler.pendingCommands).toHaveLength(1);
      expect(rebuilt?.scheduler.pendingCommands[0].id).toBe("cmd-2");

      // Should have merged the plugin state
      expect(rebuilt?.plugins).toHaveLength(1);
      expect(rebuilt?.plugins[0].state.count).toBe(5);
    });
  });
});
