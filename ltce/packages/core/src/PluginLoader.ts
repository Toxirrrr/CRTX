import { PluginManifest, Plugin } from "../../sdk/src/contracts";
import { PluginAdapter } from "../../sdk/src/PluginAdapter";

export class PluginLoader {
  validate(manifest: any): manifest is PluginManifest {
    // A strict schema validator (e.g. Zod) would be used here.
    if (!manifest || typeof manifest.id !== "string" || !Array.isArray(manifest.capabilities)) {
      throw new Error("Invalid Plugin Manifest format");
    }
    return true;
  }

  instantiate(manifest: PluginManifest, implementation: any): Plugin {
    // Resolves and instantiates the plugin using PluginAdapter
    return new PluginAdapter(manifest, implementation);
  }

  async load(manifestPath: string): Promise<{ manifest: PluginManifest, implementation: any }> {
    // In a real scenario, this performs dynamic import
    // const module = await import(manifestPath);
    // return { manifest: module.manifest, implementation: module.default };
    throw new Error("Not implemented yet for runtime dynamic imports");
  }
}
