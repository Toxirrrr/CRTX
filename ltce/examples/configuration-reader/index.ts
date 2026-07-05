import { Plugin, PluginContext, PluginManifest, HealthReport } from "@crtx/sdk";

export default class ConfigurationReaderPlugin implements Plugin {
    private retryLimit: number = 3;
    private endpoint: string = "http://localhost:8080";

    public manifest(): PluginManifest {
        return {
            id: "configuration-reader",
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "CRTX Team",
            type: "Worker",
            capabilities: [],
            permissions: []
        };
    }

    public async onLoad(ctx: PluginContext): Promise<void> {
        // Read configuration safely with defaults
        const pluginConfig = ctx.config?.plugins?.["configuration-reader"] || {};
        
        this.retryLimit = typeof pluginConfig.retryLimit === 'number' ? pluginConfig.retryLimit : 3;
        this.endpoint = typeof pluginConfig.endpoint === 'string' ? pluginConfig.endpoint : "http://localhost:8080";

        ctx.logger.info(`ConfigurationReaderPlugin initialized. Endpoint: ${this.endpoint}, Retries: ${this.retryLimit}`);
    }

    public async onUnload(): Promise<void> {}

    public async health(): Promise<HealthReport> {
        return { status: "Healthy", latency: 2 };
    }
}
