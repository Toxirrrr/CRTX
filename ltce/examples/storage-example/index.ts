import { Plugin, PluginContext, PluginManifest, HealthReport, Command } from "@crtx/sdk";

export default class StorageExamplePlugin implements Plugin {
    public manifest(): PluginManifest {
        return {
            id: "storage-example",
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "CRTX Team",
            type: "Worker",
            capabilities: [],
            permissions: ["Storage:Read", "Storage:Write"]
        };
    }

    public async onLoad(ctx: PluginContext): Promise<void> {
        ctx.logger.info("StorageExamplePlugin loaded. Ready to persist data.");
    }

    public async execute(command: Command, ctx?: PluginContext): Promise<any> {
        if (!ctx) throw new Error("PluginContext required for storage execution");

        const dataKey = `storage-example:${command.id}`;
        
        // Simulating writing a state via a generalized plugin API or event
        // Note: SDK v1.0 relies on the ExecutionEngine for direct command persistence,
        // but plugins can emit internal storage-oriented events if configured.
        ctx.logger.info(`Persisting data for command ${command.id}`);
        
        return {
            success: true,
            persistedKey: dataKey
        };
    }

    public async onUnload(): Promise<void> { }

    public async health(): Promise<HealthReport> {
        return { status: "Healthy", latency: 5 };
    }
}
