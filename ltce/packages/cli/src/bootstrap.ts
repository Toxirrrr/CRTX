import * as fs from 'fs';
import * as path from 'path';
import { RuntimeConfig } from './config';
import { DefaultBootManager, DefaultBootPolicy } from '../../core/src/boot/DefaultBootManager';
import { RuntimeConfiguration, RuntimeHost } from '../../sdk/src/runtime';
import { SQLiteStorageAdapter } from '../../sqlite/src/SQLiteStorageAdapter';
import { BetterSQLiteDriver } from '../../sqlite/src/SQLiteDriver';
import { SnapshotRepository } from '../../sqlite/src/repositories/SnapshotRepository';
import { PluginStateRepository } from '../../sqlite/src/repositories/PluginStateRepository';
import { ScheduleRepository } from '../../sqlite/src/repositories/ScheduleRepository';
import { ExecutionRepository } from '../../sqlite/src/repositories/ExecutionRepository';
import { SQLiteSerializer } from '../../sqlite/src/SQLiteSerializer';

export class AutoBootstrapper {
    static async discoverPlugins(pluginDir: string): Promise<string[]> {
        if (!fs.existsSync(pluginDir)) return [];
        const files = fs.readdirSync(pluginDir);
        const validPlugins: string[] = [];

        for (const file of files) {
            const fullPath = path.join(pluginDir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const manifestPath = path.join(fullPath, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                        if (manifest && manifest.id && manifest.version) {
                            validPlugins.push(fullPath);
                            console.log(`[Plugin Discovery] Found valid plugin: ${manifest.id}`);
                        } else {
                            console.warn(`[Plugin Discovery] Invalid manifest in ${file}`);
                        }
                    } catch (e) {
                        console.warn(`[Plugin Discovery] Failed to read manifest in ${file}`);
                    }
                }
            }
        }
        return validPlugins;
    }

    static async bootstrap(baseDir: string, config: RuntimeConfig): Promise<RuntimeHost> {
        console.log("Starting AutoBootstrapper...");

        // 1. Automatic Plugin Discovery
        const pluginPaths = await this.discoverPlugins(path.join(baseDir, config.pluginDirectory));

        // 2. Setup SQLite Backend
        const dbPath = path.join(baseDir, config.sqlitePath);
        const driver = new BetterSQLiteDriver(dbPath);
        const serializer = new SQLiteSerializer();
        const storageAdapter = new SQLiteStorageAdapter(
            driver,
            new SnapshotRepository(driver, serializer),
            new PluginStateRepository(driver, serializer),
            new ScheduleRepository(driver, serializer),
            new ExecutionRepository(driver, serializer)
        );

        // 3. Assemble RuntimeConfiguration
        const runtimeConfig: RuntimeConfiguration = {
            clock: { now: () => new Date() },
            storage: {
                snapshots: storageAdapter,
                pluginStates: storageAdapter,
                schedules: storageAdapter,
                executions: storageAdapter
            },
            telemetry: { sink: { record: (m: any) => { if(config.telemetryEnabled) console.log(`[Telemetry] ${m.name}`); } } },
            logger: console,
            plugins: pluginPaths
        };

        // 4. Initialize BootManager
        const bootManager = new DefaultBootManager(new DefaultBootPolicy());
        
        console.log("Evaluating boot policy...");
        const host = await bootManager.bootstrap(runtimeConfig);
        
        console.log("Bootstrapping complete. Runtime is ready.");
        return host;
    }
}
