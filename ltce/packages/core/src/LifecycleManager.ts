import { PluginCatalog } from "./PluginCatalog";
import { PluginContext } from "../../sdk/src/contracts";

export class LifecycleManager {
  constructor(private readonly catalog: PluginCatalog) {}

  async startPlugin(pluginId: string, ctx: PluginContext): Promise<void> {
    const descriptor = this.catalog.findById(pluginId);
    if (!descriptor || !descriptor.instance) {
      throw new Error(`Plugin ${pluginId} not found or has no instance.`);
    }

    descriptor.state = "LOADING";
    try {
      await descriptor.instance.onLoad(ctx);
      descriptor.state = "RUNNING";
      descriptor.loadedAt = new Date();
      
      // Perform initial health check
      descriptor.health = await descriptor.instance.health();
    } catch (err) {
      descriptor.state = "FAILED";
      throw new Error(`Failed to load plugin ${pluginId}: ${err}`);
    }
  }

  async stopPlugin(pluginId: string): Promise<void> {
    const descriptor = this.catalog.findById(pluginId);
    if (!descriptor || !descriptor.instance) return;

    if (descriptor.state === "RUNNING" || descriptor.state === "DEGRADED") {
      try {
        await descriptor.instance.onUnload();
      } catch (err) {
        console.error(`Error unloading plugin ${pluginId}`, err);
      }
    }
    descriptor.state = "STOPPED";
  }

  async checkHealth(pluginId: string): Promise<void> {
    const descriptor = this.catalog.findById(pluginId);
    if (!descriptor || !descriptor.instance || descriptor.state !== "RUNNING") return;

    try {
      const report = await descriptor.instance.health();
      descriptor.health = report;
      if (report.status === "Degraded") {
        descriptor.state = "DEGRADED";
      }
    } catch (err) {
      descriptor.health = { status: "Unavailable", latency: 0, message: String(err) };
      descriptor.state = "DEGRADED";
    }
  }
}
