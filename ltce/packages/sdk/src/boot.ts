import { SnapshotVersion } from "./persistence";
import { RuntimeConfiguration, RuntimeHost } from "./runtime";

export type BootMode = 
    | "COLD_START"
    | "WARM_START"
    | "CRASH_RECOVERY"
    | "SAFE_MODE"
    | "READ_ONLY"
    | "MIGRATION_REQUIRED"
    | "INCOMPATIBLE_VERSION";

export interface RecoveryDecision {
    mode: BootMode;
    message: string;
    shouldRecover: boolean;
    snapshotVersion?: SnapshotVersion;
}

export interface BootPolicy {
    evaluate(config: RuntimeConfiguration): Promise<RecoveryDecision>;
}

export interface BootManager {
    /**
     * Determines the boot mode and returns a constructed and appropriately 
     * initialized RuntimeHost, or throws if the boot is unsafe.
     */
    bootstrap(config: RuntimeConfiguration): Promise<RuntimeHost>;
}
