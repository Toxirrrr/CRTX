import { PluginCatalog } from "./PluginCatalog";
import { PluginLoader } from "./PluginLoader";
import { PluginDescriptor } from "../../sdk/src/contracts";
import { randomUUID } from "crypto";

export class PluginRegistry {
  constructor(
    private readonly catalog: PluginCatalog,
    private readonly loader: PluginLoader
  ) {}

  async loadAndRegister(manifestPath: string): Promise<string> {
    const { manifest, implementation } = await this.loader.load(manifestPath);
    this.loader.validate(manifest);
    
    const instance = this.loader.instantiate(manifest, implementation);
    const instanceId = randomUUID();

    const descriptor: PluginDescriptor = {
      instanceId,
      manifest,
      state: "REGISTERED",
      health: { status: "Unavailable", latency: 0 },
      instance,
    };

    this.catalog.register(descriptor);
    return descriptor.manifest.id;
  }

  getCatalog(): PluginCatalog {
    return this.catalog;
  }
}
