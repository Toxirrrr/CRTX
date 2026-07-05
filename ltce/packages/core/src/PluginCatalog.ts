import { PluginDescriptor } from "../../sdk/src/contracts";
import { Capability } from "../../types/src";

export class PluginCatalog {
  private descriptors = new Map<string, PluginDescriptor>();

  register(descriptor: PluginDescriptor): void {
    if (this.descriptors.has(descriptor.manifest.id)) {
      throw new Error(`Plugin ${descriptor.manifest.id} is already registered.`);
    }
    this.descriptors.set(descriptor.manifest.id, descriptor);
  }

  unregister(id: string): void {
    this.descriptors.delete(id);
  }

  findById(id: string): PluginDescriptor | undefined {
    return this.descriptors.get(id);
  }

  findByCapability(capability: Capability): PluginDescriptor[] {
    return Array.from(this.descriptors.values()).filter(desc => 
      desc.manifest.capabilities.includes(capability)
    );
  }
}
