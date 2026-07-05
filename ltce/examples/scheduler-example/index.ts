import { Plugin, PluginContext, PluginManifest, HealthReport, Command } from "@crtx/sdk";

export default class SchedulerExamplePlugin implements Plugin {
    private intervalId?: NodeJS.Timeout;

    public manifest(): PluginManifest {
        return {
            id: "scheduler-example",
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "CRTX Team",
            type: "Worker",
            capabilities: ["Planning"],
            permissions: []
        };
    }

    public async onLoad(ctx: PluginContext): Promise<void> {
        ctx.logger.info("SchedulerExamplePlugin: Initializing internal scheduler task...");
        
        // Simulating an internal scheduled task emitting events
        this.intervalId = setInterval(() => {
            if (ctx.cancellationToken.isCancelled) {
                clearInterval(this.intervalId);
                return;
            }
            
            ctx.logger.info("SchedulerExamplePlugin: Scheduled tick fired.");
            // To actually dispatch a command back to the runtime, you would use ctx.capabilityLookup to find targets
            // For now, we just demonstrate logging on a schedule.
        }, 10000);
    }

    public async execute(command: Command, ctx?: PluginContext): Promise<any> {
        if (ctx) ctx.logger.info(`Received command: ${command.id}`);
        return { success: true, status: "scheduled_work_completed" };
    }

    public async onUnload(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    public async health(): Promise<HealthReport> {
        return { status: "Healthy", latency: 5, message: "Scheduler is running." };
    }
}
