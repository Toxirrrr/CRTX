import { StorageConfiguration, TelemetryConfiguration, RuntimeConfiguration } from "../../sdk/src/runtime";
import { PluginCatalog } from "../PluginCatalog";
import { CommandDispatcher } from "../CommandDispatcher";
import { PipelineExecutor } from "../pipeline/PipelineExecutor";
import { TelemetryBehavior } from "../telemetry/TelemetryBehavior";
import { InMemoryScheduler } from "../InMemoryScheduler";
import { RegistryPlanner } from "../orchestration/RegistryPlanner";
import { CoreOrchestrator } from "../orchestration/CoreOrchestrator";
import { RecoveryService } from "../persistence/RecoveryService";
import { FirstMatchPolicy } from "../policies/FirstMatchPolicy";

export class RuntimeHost {
    private catalog: PluginCatalog;
    private dispatcher: CommandDispatcher;
    private pipeline: PipelineExecutor;
    private scheduler: InMemoryScheduler;
    private planner: RegistryPlanner;
    private orchestrator: CoreOrchestrator;
    private recoveryService: RecoveryService;

    constructor(private readonly config: RuntimeConfiguration) {
        // Initialize Core Services
        this.catalog = new PluginCatalog();
        
        const capabilityLookup = {
            find: (cap: string) => this.catalog.findAll().flatMap(d => d.manifest.capabilities.includes(cap as any) ? [{ pluginId: d.manifest.id, capability: cap as any, version: '1' }] : []),
            supports: () => true
        };

        this.dispatcher = new CommandDispatcher(capabilityLookup, new FirstMatchPolicy(), this.catalog);
        
        const telemetryBehavior = new TelemetryBehavior(this.config.telemetry.sink, this.config.clock);
        this.pipeline = new PipelineExecutor([telemetryBehavior], this.dispatcher, this.config.clock);

        // If the configuration provided a scheduler, we would use it here. 
        // For now, we instantiate the InMemoryScheduler as the default.
        this.scheduler = new InMemoryScheduler(this.pipeline, this.config.clock);

        this.planner = new RegistryPlanner();
        this.orchestrator = new CoreOrchestrator(this.planner, this.scheduler);

        this.recoveryService = new RecoveryService(
            this.config.storage.snapshots,
            this.config.storage.pluginStates,
            this.config.storage.schedules
        );
    }

    public async initialize(): Promise<void> {
        // Plugin initialization is handled by AutoBootstrapper prior to RuntimeHost boot
    }

    public async recover(): Promise<void> {
        const snapshot = await this.recoveryService.rebuildRuntime();
        if (snapshot) {
            // Issue #1: Apply snapshot state to Scheduler and PluginCatalog
        }
    }

    public async start(): Promise<void> {
    }

    public async stop(): Promise<void> {
        this.scheduler.shutdown();
    }

    public async dispose(): Promise<void> {
        await this.stop();
        if (this.config.storage.dispose) {
            await this.config.storage.dispose();
        }
    }

    // Expose core services for tests or external adapters
    public getOrchestrator(): CoreOrchestrator {
        return this.orchestrator;
    }
    
    public getPlanner(): RegistryPlanner {
        return this.planner;
    }

    public getCatalog(): PluginCatalog {
        return this.catalog;
    }
}
