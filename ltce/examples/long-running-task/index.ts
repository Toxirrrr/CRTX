import { Plugin, PluginContext, PluginManifest, HealthReport, Command } from "@crtx/sdk";

export default class LongRunningTaskPlugin implements Plugin {
    private activeWork: Set<Promise<any>> = new Set();
    private shuttingDown: boolean = false;

    public manifest(): PluginManifest {
        return {
            id: "long-running-task",
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "CRTX Team",
            type: "Worker",
            capabilities: ["ResolveSemantic"],
            permissions: []
        };
    }

    public async onLoad(ctx: PluginContext): Promise<void> {
        ctx.logger.info("LongRunningTaskPlugin loaded.");
    }

    public async execute(command: Command, ctx?: PluginContext): Promise<any> {
        if (this.shuttingDown) {
            throw new Error("Plugin is shutting down, rejecting new work.");
        }

        const work = this.simulateLongWork(command.id, ctx);
        this.activeWork.add(work);

        try {
            return await work;
        } finally {
            this.activeWork.delete(work);
        }
    }

    private async simulateLongWork(id: string, ctx?: PluginContext): Promise<any> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (ctx?.cancellationToken.isCancelled) {
                    reject(new Error("Cancelled by runtime"));
                } else {
                    resolve({ success: true, id, status: "completed" });
                }
            }, 5000);

            // Periodically check cancellation to simulate interruptible work
            const checkInterval = setInterval(() => {
                if (ctx?.cancellationToken.isCancelled) {
                    clearTimeout(timer);
                    clearInterval(checkInterval);
                    reject(new Error("Cancelled by runtime"));
                }
            }, 500);
        });
    }

    public async onUnload(): Promise<void> {
        this.shuttingDown = true;
        // Wait for all active work to either finish or abort via cancellation token
        await Promise.allSettled(Array.from(this.activeWork));
    }

    public async health(): Promise<HealthReport> {
        return { 
            status: this.shuttingDown ? "Degraded" : "Healthy", 
            latency: 10,
            details: { activeTasks: this.activeWork.size }
        };
    }
}
