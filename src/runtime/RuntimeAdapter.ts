/**
 * RuntimeAdapter — universal contract that every AI tool/IDE must implement.
 *
 * Adding a new tool (Cursor, Windsurf, Codex CLI, etc.) = implement this interface.
 * The core (TaskBus, Router, Watchdog) never changes.
 */

export interface Task {
  id: string;
  title?: string;
  capability?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RuntimeHealth {
  online: boolean;
  lastCheckedAt: string;
  latencyMs?: number;
}

export interface RuntimeResult {
  success: boolean;
  runtimeName: string;
  output?: string;
  error?: string;
  executedAt: string;
}

export interface RuntimeAdapter {
  /** Unique name matching keys in runtime_registry.json */
  readonly name: string;
  /** Provider name: "anthropic", "google", "openai", "openrouter", etc. */
  readonly provider: string;
  /** Supported model identifiers */
  readonly models: string[];
  /** Declared capabilities this runtime can handle */
  readonly capabilities: string[];

  /** Live health check — reads from runtime_health.json or pings the process */
  health(): Promise<RuntimeHealth>;

  /** Execute a task. Returns PARKED result if not available. */
  execute(task: Task): Promise<RuntimeResult>;
}
