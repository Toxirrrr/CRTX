# CLI Reference

The CRTX CLI provides native tools for managing the runtime.

## `npx crtx init`
Initializes the CRTX environment. Generates `runtime.json` using Zod schemas for validation and creates `data/` and `plugins/` directories.

## `npx crtx start`
Boots the runtime:
- Evaluates the `BootPolicy` (Cold Start, Warm Restart, Crash Recovery).
- Connects to SQLite (WAL mode).
- Discovers and loads plugins from the `plugins/` directory.

## `npx crtx stop`
Gracefully halts the execution pipeline. Triggers `onUnload()` across all plugins, flushes telemetry, and calls `dispose()` on the SQLite driver.

## `npx crtx status`
Displays the current status of the runtime configuration and SQLite presence.

## `npx crtx doctor`
Diagnoses the environment. Validates the existence of `runtime.json`, the `data/` directory, and permissions.

## `npx crtx backup`
Creates a point-in-time snapshot of the SQLite database.

## `npx crtx restore <backup_file>`
Restores the database from a specified backup file.

## `npx crtx create-plugin <name>`
Generates a new plugin template inside the `plugins/` directory. The output is structurally identical to the `examples/hello-world` plugin.
