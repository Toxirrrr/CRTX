import { PluginDescriptor, CapabilityMatch } from "../../sdk/src/contracts";
import { Capability } from "../../types/src";

export class CapabilityRouter {
  // Index: Capability -> Set of PluginDescriptors
  private capabilityIndex = new Map<Capability, Set<PluginDescriptor>>();
  // Index: PluginId -> PluginDescriptor (for fast supports/unregister lookup)
  private pluginIndex = new Map<string, PluginDescriptor>();

  register(descriptor: PluginDescriptor): void {
    const pluginId = descriptor.manifest.id;
    if (this.pluginIndex.has(pluginId)) {
      return; // Already registered
    }

    this.pluginIndex.set(pluginId, descriptor);

    for (const cap of descriptor.manifest.capabilities) {
      if (!this.capabilityIndex.has(cap)) {
        this.capabilityIndex.set(cap, new Set());
      }
      this.capabilityIndex.get(cap)!.add(descriptor);
    }
  }

  unregister(pluginId: string): void {
    const descriptor = this.pluginIndex.get(pluginId);
    if (!descriptor) return;

    for (const cap of descriptor.manifest.capabilities) {
      const set = this.capabilityIndex.get(cap);
      if (set) {
        set.delete(descriptor);
        if (set.size === 0) {
          this.capabilityIndex.delete(cap);
        }
      }
    }
    
    this.pluginIndex.delete(pluginId);
  }

  find(capability: Capability): CapabilityMatch[] {
    const set = this.capabilityIndex.get(capability);
    if (!set) return [];

    const matches: CapabilityMatch[] = [];
    for (const descriptor of set) {
      matches.push({
        pluginId: descriptor.manifest.id,
        capability,
        version: descriptor.manifest.version
      });
    }

    return matches;
  }

  supports(pluginId: string, capability: Capability): boolean {
    const descriptor = this.pluginIndex.get(pluginId);
    if (!descriptor) return false;
    
    return descriptor.manifest.capabilities.includes(capability);
  }
}
