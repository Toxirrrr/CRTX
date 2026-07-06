import { EventBus } from '../events/EventBus';
import { CRTXPlugin, PluginContext } from './types';

export class PluginManager {
  private plugins: CRTXPlugin[] = [];

  constructor(private eventBus: EventBus) {}

  register(plugin: CRTXPlugin) {
    this.plugins.push(plugin);
    console.log(`[PluginManager] Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  async initializeAll(context: PluginContext) {
    for (const plugin of this.plugins) {
      try {
        await plugin.init(this.eventBus, context);
        console.log(`[PluginManager] Initialized plugin: ${plugin.name}`);
      } catch (error) {
        console.error(`[PluginManager] Failed to initialize plugin ${plugin.name}:`, error);
      }
    }
  }
}
