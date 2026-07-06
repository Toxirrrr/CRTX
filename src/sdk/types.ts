import { EventBus } from '../events/EventBus';

export interface PluginContext {
  version: string;
}

export interface CRTXPlugin {
  name: string;
  version: string;
  
  /**
   * Called when CRTX starts to initialize the plugin.
   * Plugins should subscribe to the EventBus here.
   */
  init(eventBus: EventBus, context: PluginContext): Promise<void> | void;
}
