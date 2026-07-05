import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export const RuntimeConfigSchema = z.object({
    sqlitePath: z.string().default("data/runtime.db"),
    pluginDirectory: z.string().default("plugins"),
    telemetryEnabled: z.boolean().default(true),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export class ConfigManager {
    static readonly CONFIG_FILE = 'runtime.json';

    static load(baseDir: string): RuntimeConfig {
        const configPath = path.join(baseDir, this.CONFIG_FILE);
        if (!fs.existsSync(configPath)) {
            console.error(`[FATAL] Configuration file missing: ${configPath}`);
            console.error(`Run 'crtx init' to create a default configuration.`);
            process.exit(1);
        }

        try {
            const data = fs.readFileSync(configPath, 'utf-8');
            const parsedJson = JSON.parse(data);
            const validationResult = RuntimeConfigSchema.safeParse(parsedJson);

            if (!validationResult.success) {
                console.error(`[FATAL] Invalid configuration in ${this.CONFIG_FILE}:`);
                for (const error of validationResult.error.errors) {
                    console.error(`  - ${error.path.join('.')}: ${error.message}`);
                }
                process.exit(1);
            }

            return validationResult.data;
        } catch (err) {
            console.error(`[FATAL] Failed to read or parse ${this.CONFIG_FILE}. Error: ${err}`);
            process.exit(1);
        }
    }

    static init(baseDir: string): void {
        const configPath = path.join(baseDir, this.CONFIG_FILE);
        const defaultConfig = RuntimeConfigSchema.parse({});

        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(`Created ${this.CONFIG_FILE}`);
        } else {
            console.log(`${this.CONFIG_FILE} already exists.`);
        }

        // Create data and plugins directories
        const dbDir = path.dirname(path.join(baseDir, defaultConfig.sqlitePath));
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        
        const pluginDir = path.join(baseDir, defaultConfig.pluginDirectory);
        if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });
    }
}
