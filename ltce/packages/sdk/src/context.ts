import { EventPublisher } from "./events";
import { Capability } from "../../types/src";
import { CapabilityMatch } from "./contracts";

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface Telemetry {
  increment(metric: string, value?: number): void;
  record(metric: string, value: number): void;
  measure<T>(metric: string, operation: () => Promise<T>): Promise<T>;
}

export interface CancellationToken {
  readonly isCancelled: boolean;
  throwIfCancelled(): void;
}

export interface CapabilityLookup {
  find(capability: Capability): CapabilityMatch[];
  supports(pluginId: string, capability: Capability): boolean;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly eventPublisher: EventPublisher;
  readonly telemetry: Telemetry;
  readonly cancellationToken: CancellationToken;
  readonly capabilityLookup: CapabilityLookup;
}
