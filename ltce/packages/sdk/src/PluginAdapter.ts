import { Plugin, PluginContext, HealthReport, PluginManifest } from "./contracts";

/**
 * Lightweight Plugin Adapter using composition over inheritance.
 * This ensures we don't end up with a God Object BasePlugin.
 */
export class PluginAdapter implements Plugin {
  constructor(
    private readonly _manifest: PluginManifest,
    private readonly implementation: {
      onLoad?: (ctx: PluginContext) => Promise<void>;
      onUnload?: () => Promise<void>;
      health?: () => Promise<HealthReport>;
      execute?: <T>(command: any) => Promise<any>;
    }
  ) {}

  manifest(): PluginManifest {
    return this._manifest;
  }

  async onLoad(ctx: PluginContext): Promise<void> {
    if (this.implementation.onLoad) {
      await this.implementation.onLoad(ctx);
    }
  }

  async onUnload(): Promise<void> {
    if (this.implementation.onUnload) {
      await this.implementation.onUnload();
    }
  }

  async health(): Promise<HealthReport> {
    if (this.implementation.health) {
      return this.implementation.health();
    }
    return { status: "Healthy", latency: 0 };
  }

  async execute<T>(command: any): Promise<any> {
    if (this.implementation.execute) {
      return this.implementation.execute(command);
    }
    throw new Error(`Plugin ${this._manifest.id} does not implement execute()`);
  }
}
