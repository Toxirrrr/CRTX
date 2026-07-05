import { Plugin, PluginContext, PluginManifest, HealthReport } from "@crtx/sdk";

export default class HelloWorldPlugin implements Plugin {
    public manifest(): PluginManifest {
        // Read from manifest.json in real implementation, or return literal here
        return {
            id: "hello-world",
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "CRTX Team",
            type: "Worker",
            capabilities: ["Metrics"],
            permissions: []
        };
    }

    public async onLoad(ctx: PluginContext): Promise<void> {
        ctx.logger.info("HelloWorldPlugin has been loaded.");
    }

    public async execute(command: any, ctx?: PluginContext): Promise<any> {
        return {
            success: true,
            message: "Hello World from CRTX Runtime v1.0!"
        };
    }

    public async onUnload(): Promise<void> {
        // Cleanup resources
    }

    public async health(): Promise<HealthReport> {
        return {
            status: "Healthy",
            latency: 0,
            message: "Hello World is running optimally."
        };
    }
}
