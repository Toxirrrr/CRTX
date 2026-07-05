import { CapabilityMatch } from "../../sdk/src/contracts";
import { 
  PluginContext, 
  Logger, 
  Clock, 
  Telemetry, 
  CancellationToken, 
  CapabilityLookup 
} from "../../sdk/src/context";
import { EventPublisher } from "../../sdk/src/events";
import { Capability } from "../../types/src";
import { CapabilityRouter } from "./CapabilityRouter";

class ScopedLogger implements Logger {
  constructor(private readonly baseLogger: Logger, private readonly pluginId: string) {}

  info(message: string, ...args: any[]): void { this.baseLogger.info(`[${this.pluginId}] ${message}`, ...args); }
  warn(message: string, ...args: any[]): void { this.baseLogger.warn(`[${this.pluginId}] ${message}`, ...args); }
  error(message: string, ...args: any[]): void { this.baseLogger.error(`[${this.pluginId}] ${message}`, ...args); }
  debug(message: string, ...args: any[]): void { this.baseLogger.debug(`[${this.pluginId}] ${message}`, ...args); }
}

class CapabilityLookupAdapter implements CapabilityLookup {
  constructor(private readonly router: CapabilityRouter) {}

  find(capability: Capability): CapabilityMatch[] {
    return this.router.find(capability);
  }

  supports(pluginId: string, capability: Capability): boolean {
    return this.router.supports(pluginId, capability);
  }
}

export class ContextBuilder {
  constructor(
    private readonly clock: Clock,
    private readonly baseLogger: Logger,
    private readonly eventPublisher: EventPublisher,
    private readonly telemetry: Telemetry,
    private readonly router: CapabilityRouter
  ) {}

  build(pluginId: string, cancellationToken: CancellationToken): PluginContext {
    const context: PluginContext = {
      pluginId,
      clock: this.clock,
      logger: new ScopedLogger(this.baseLogger, pluginId),
      eventPublisher: this.eventPublisher,
      telemetry: this.telemetry,
      cancellationToken,
      capabilityLookup: new CapabilityLookupAdapter(this.router)
    };

    return Object.freeze(context);
  }
}
