import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './config';
import { AutoBootstrapper } from './bootstrap';

export class CLICommands {
    static init(baseDir: string): void {
        console.log("Initializing CRTX Runtime Environment...");
        ConfigManager.init(baseDir);
        console.log("Initialization complete. You can now run `crtx start`.");
    }

    static async start(baseDir: string): Promise<void> {
        console.log("Starting CRTX Runtime...");
        const config = ConfigManager.load(baseDir);
        
        try {
            const host = await AutoBootstrapper.bootstrap(baseDir, config);
            await host.start();
            console.log("CRTX Runtime successfully started and running.");
            
            // Keep process alive
            process.on('SIGINT', async () => {
                console.log("Received SIGINT. Shutting down gracefully...");
                await host.stop();
                await host.dispose();
                process.exit(0);
            });
        } catch (err) {
            console.error("Failed to start CRTX Runtime:", err);
            process.exit(1);
        }
    }

    static stop(baseDir: string): void {
        // In a real implementation with detached processes, this would send a signal.
        // For a single-node direct execution, stopping is handled via SIGINT.
        console.log("To stop the running runtime, press Ctrl+C in the terminal where it is running.");
    }

    static status(baseDir: string): void {
        const config = ConfigManager.load(baseDir);
        const dbExists = fs.existsSync(path.join(baseDir, config.sqlitePath));
        console.log(`Runtime Config: loaded`);
        console.log(`Database Status: ${dbExists ? 'Found' : 'Missing'}`);
        // Extended status check could read PID file
    }

    static doctor(baseDir: string): void {
        console.log("Running CRTX Doctor...");
        let issues = 0;
        
        const configPath = path.join(baseDir, ConfigManager.CONFIG_FILE);
        if (!fs.existsSync(configPath)) {
            console.error(`[ERROR] Configuration file missing: ${configPath}`);
            issues++;
        } else {
            console.log(`[OK] Configuration file found`);
        }

        const config = ConfigManager.load(baseDir);
        
        const dbDir = path.dirname(path.join(baseDir, config.sqlitePath));
        if (!fs.existsSync(dbDir)) {
            console.error(`[ERROR] Database directory missing: ${dbDir}`);
            issues++;
        } else {
            console.log(`[OK] Database directory exists`);
        }

        const pluginDir = path.join(baseDir, config.pluginDirectory);
        if (!fs.existsSync(pluginDir)) {
            console.error(`[ERROR] Plugin directory missing: ${pluginDir}`);
            issues++;
        } else {
            console.log(`[OK] Plugin directory exists`);
        }

        if (issues === 0) {
            console.log("Environment is healthy and ready to run.");
        } else {
            console.warn(`Found ${issues} issues. Run 'crtx init' to repair.`);
        }
    }

    static backup(baseDir: string): void {
        const config = ConfigManager.load(baseDir);
        const dbPath = path.join(baseDir, config.sqlitePath);
        
        if (!fs.existsSync(dbPath)) {
            console.error("No database found to backup.");
            return;
        }

        const backupPath = `${dbPath}.backup-${Date.now()}`;
        try {
            fs.copyFileSync(dbPath, backupPath);
            console.log(`Database successfully backed up to: ${backupPath}`);
        } catch (err) {
            console.error("Backup failed:", err);
        }
    }

    static restore(baseDir: string, backupFile: string): void {
        const config = ConfigManager.load(baseDir);
        const dbPath = path.join(baseDir, config.sqlitePath);
        const sourcePath = path.join(baseDir, backupFile);

        if (!fs.existsSync(sourcePath)) {
            console.error(`Backup file not found: ${sourcePath}`);
            return;
        }

        try {
            fs.copyFileSync(sourcePath, dbPath);
            console.log(`Database successfully restored from: ${sourcePath}`);
        } catch (err) {
            console.error("Restore failed:", err);
        }
    }

    static createPlugin(baseDir: string, pluginName: string): void {
        const config = ConfigManager.load(baseDir);
        const pluginDir = path.join(baseDir, config.pluginDirectory, pluginName);

        if (fs.existsSync(pluginDir)) {
            console.error(`Plugin directory already exists: ${pluginDir}`);
            return;
        }

        fs.mkdirSync(pluginDir, { recursive: true });

        const manifest = {
            id: pluginName,
            version: "1.0.0",
            ltceVersion: "1.0.0",
            author: "Your Name",
            type: "utility",
            capabilities: ["example_capability"],
            permissions: []
        };

        const className = pluginName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Plugin';

        const indexTs = `import { PluginContext } from '@crtx/sdk/context';
import { Command } from '@crtx/sdk/command';

/**
 * ${className}
 * Automatically generated by CRTX CLI.
 */
export default class ${className} {
    /**
     * Called when the plugin is loaded into the runtime.
     */
    async onLoad(ctx: PluginContext): Promise<void> {
        ctx.logger.info("${pluginName} loaded successfully.");
    }

    /**
     * Executes a command routed to this plugin based on its capabilities.
     * @param command The incoming command object.
     * @param ctx The execution context provided by the runtime.
     */
    async execute(command: Command, ctx: PluginContext): Promise<any> {
        ctx.logger.info(\`Executing command: \${command.id} with capability \${command.capability}\`);
        
        // TODO: Implement your business logic here
        
        return { success: true, executedBy: "${pluginName}" };
    }

    /**
     * Called when the plugin is unloaded or the runtime shuts down.
     */
    async onUnload(): Promise<void> {
        // Cleanup resources (e.g. database connections, file handles)
    }

    /**
     * Returns the health status of the plugin.
     */
    async health(): Promise<any> {
        return { status: "Healthy", latency: 0 };
    }
}
`;

        const packageJson = {
            name: pluginName,
            version: "1.0.0",
            main: "index.ts",
            scripts: {
                "build": "tsc",
                "test": "vitest run"
            },
            dependencies: {
                "@crtx/sdk": "workspace:*"
            },
            devDependencies: {
                "typescript": "^5.4.5",
                "vitest": "^1.6.0"
            }
        };

        const tsconfig = {
            compilerOptions: {
                target: "ES2022",
                module: "CommonJS",
                moduleResolution: "node",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                outDir: "./dist"
            },
            include: ["./**/*.ts"],
            exclude: ["node_modules"]
        };

        const specTs = `import { describe, it, expect } from 'vitest';
import ${className} from './index';

describe('${className}', () => {
    it('should have health method returning Healthy', async () => {
        const plugin = new ${className}();
        const result = await plugin.health();
        expect(result.status).toBe('Healthy');
    });
});
`;

        const readme = `# ${pluginName}

A CRTX Runtime Plugin.

## Capabilities
- \`example_capability\`

## Development
\`\`\`bash
npm install
npm test
npm run build
\`\`\`
`;

        fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
        fs.writeFileSync(path.join(pluginDir, 'index.ts'), indexTs);
        fs.writeFileSync(path.join(pluginDir, 'index.spec.ts'), specTs);
        fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify(packageJson, null, 2));
        fs.writeFileSync(path.join(pluginDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
        fs.writeFileSync(path.join(pluginDir, 'README.md'), readme);

        console.log(`✅ Plugin '${pluginName}' successfully created at ${pluginDir}`);
        console.log(`-> Edit index.ts to implement your plugin capabilities.`);
        console.log(`-> Run tests with 'npm test'.`);
    }
}
