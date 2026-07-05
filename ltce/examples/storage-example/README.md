# Storage Example Plugin

## Purpose
Show correct interaction with permission scopes requiring Storage access.

## Architecture
Requires `"Storage:Read"` and `"Storage:Write"`. Demonstrates payload generation destined for the SQLite WAL-enabled persistence layer.

## Execution Flow
1. Load verifies permissions.
2. `execute()` dynamically computes a persistent key based on `command.id`.
3. Returns a structured format recognized by the PipelineExecutor to store the execution record automatically.

## Expected Output
```
StorageExamplePlugin loaded. Ready to persist data.
Persisting data for command XYZ-123
```

## Files
- `manifest.json`: Defines permissions.
- `index.ts`: Implementation.
- `package.json`: Dependency declaration.

## Extension Points
Can be combined with `event-handler` to listen for snapshot requests and commit deep plugin state to the `PluginStateRepository`.

## Common Mistakes
- Trying to initialize a secondary SQLite connection manually inside the plugin instead of relying on the single-node runtime persistence pipeline.

## Next Steps
Check `long-running-task` for stateful recovery concepts.
