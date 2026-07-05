import { BootManager, BootPolicy, RecoveryDecision } from "../../../sdk/src/boot";
import { RuntimeConfiguration, RuntimeHost } from "../../../sdk/src/runtime";
import { RuntimeHost as CoreRuntimeHost } from "../runtime/RuntimeHost";

export class DefaultBootManager implements BootManager {
    constructor(private readonly policy: BootPolicy) {}

    async bootstrap(config: RuntimeConfiguration): Promise<RuntimeHost> {
        // 1. Health Checks
        await this.performHealthChecks(config);

        // 2. Evaluate Policy
        const decision = await this.policy.evaluate(config);

        // 3. Handle Decisions
        if (decision.mode === "INCOMPATIBLE_VERSION") {
            throw new Error(`Cannot boot: ${decision.message}`);
        }

        if (decision.mode === "MIGRATION_REQUIRED") {
            throw new Error(`Migration required before boot: ${decision.message}`);
        }

        // 4. Initialize Host
        const host = new CoreRuntimeHost(config);

        // 5. Recover if needed
        if (decision.shouldRecover) {
            await host.recover();
        }

        return host;
    }

    private async performHealthChecks(config: RuntimeConfiguration): Promise<void> {
        // e.g., ensure storage is accessible
        try {
            await config.storage.snapshots.getLatestRuntimeSnapshot();
        } catch (err) {
            throw new Error("StorageHealthCheck failed: Unable to access snapshot store");
        }
    }
}

export class DefaultBootPolicy implements BootPolicy {
    private readonly currentVersion = { major: 1, minor: 0 };

    async evaluate(config: RuntimeConfiguration): Promise<RecoveryDecision> {
        const latestSnapshot = await config.storage.snapshots.getLatestRuntimeSnapshot();
        
        if (!latestSnapshot) {
            return {
                mode: "COLD_START",
                message: "No snapshot found, performing cold start",
                shouldRecover: false
            };
        }

        const snapVersion = latestSnapshot.version;
        if (!snapVersion) {
            return {
                mode: "MIGRATION_REQUIRED",
                message: "Snapshot is missing version information",
                shouldRecover: false
            };
        }

        if (snapVersion.major > this.currentVersion.major) {
            return {
                mode: "INCOMPATIBLE_VERSION",
                message: `Snapshot version v${snapVersion.major}.${snapVersion.minor} is newer than runtime v${this.currentVersion.major}.${this.currentVersion.minor}`,
                shouldRecover: false,
                snapshotVersion: snapVersion
            };
        }

        if (snapVersion.major < this.currentVersion.major) {
            return {
                mode: "MIGRATION_REQUIRED",
                message: `Snapshot version v${snapVersion.major}.${snapVersion.minor} needs migration to v${this.currentVersion.major}.${this.currentVersion.minor}`,
                shouldRecover: false,
                snapshotVersion: snapVersion
            };
        }

        // Simplistic check for crash recovery vs warm restart
        // Real implementation would check locks, pid files, or shutdown flags in the snapshot metadata.
        const wasCleanShutdown = latestSnapshot.metadata?.cleanShutdown === true;

        if (!wasCleanShutdown) {
            return {
                mode: "CRASH_RECOVERY",
                message: "Previous shutdown was unclean, attempting crash recovery",
                shouldRecover: true,
                snapshotVersion: snapVersion
            };
        }

        return {
            mode: "WARM_START",
            message: "Clean snapshot found, performing warm start",
            shouldRecover: true,
            snapshotVersion: snapVersion
        };
    }
}
