import { Capability } from "../../types/src";

export type PluginState = 
  | "REGISTERED" 
  | "LOADING" 
  | "RUNNING" 
  | "DEGRADED" 
  | "STOPPED"
  | "FAILED";

export type Permission = 
  | "Storage:Read" 
  | "Storage:Write" 
  | "EventBus:Publish" 
  | "EventBus:Subscribe" 
  | "Network:Http";

export interface PluginManifest {
  id: string;
  version: string;
  ltceVersion: string;
  author: string;
  type: string;
  capabilities: Capability[];
  permissions: Permission[];
  dependencies?: string[];
}

export interface HealthReport {
  status: "Healthy" | "Degraded" | "Unavailable";
  latency: number;
  message?: string;
  details?: Record<string, any>;
}

export interface PluginContext {
  logger: any; // Minimal abstract logger interface later
  metrics: any;
  config: any;
}

export interface Plugin {
  manifest(): PluginManifest;
  onLoad(ctx: PluginContext): Promise<void>;
  onUnload(): Promise<void>;
  health(): Promise<HealthReport>;
  execute?<T>(command: any): Promise<any>; // Using any to avoid circular deps, will be properly typed if moved
}

export interface PluginDescriptor {
  instanceId: string;
  manifest: PluginManifest;
  state: PluginState;
  loadedAt?: Date;
  health: HealthReport;
  instance: Plugin | null;
}

export interface CapabilityMatch {
  pluginId: string;
  capability: Capability;
  version: string;
  // Future extensions: priority, cost, latency, availability, health, locality
}
