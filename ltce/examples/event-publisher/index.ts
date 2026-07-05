import { Plugin, PluginContext, PluginManifest, HealthReport, Command } from "@crtx/sdk";

export default class EventPublisherPlugin implements Plugin {
    public manifest(): PluginManifest {
        return {
            id: "event-publisher",
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "CRTX Team",
            type: "Worker",
            capabilities: [],
            permissions: ["EventBus:Publish"]
        };
    }

    public async onLoad(ctx: PluginContext): Promise<void> {
        ctx.logger.info("EventPublisherPlugin loaded. Ready to publish events.");
    }

    public async execute(command: Command, ctx?: PluginContext): Promise<any> {
        if (!ctx) throw new Error("Context required to publish events.");
        
        ctx.logger.info(`Processing command ${command.id}. Emitting domain event.`);
        
        const result = await ctx.eventPublisher.publish({
            id: `evt-${Date.now()}`,
            type: "Domain.CommandProcessed",
            payload: { commandId: command.id, status: "success" },
            occurredAt: ctx.clock.now(),
            sourcePlugin: this.manifest().id,
            version: 1
        });

        if (result.failed > 0) {
            ctx.logger.warn(`Failed to deliver ${result.failed} events.`);
        }

        return { success: true, deliveredEvents: result.delivered };
    }

    public async onUnload(): Promise<void> {}

    public async health(): Promise<HealthReport> {
        return { status: "Healthy", latency: 2 };
    }
}
