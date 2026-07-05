# Long Running Task Plugin

## Purpose
Demonstrate proper lifecycle management, cancellation, graceful shutdown, and resource cleanup.

## Architecture
Tracks active `Promise` instances. During `execute()`, the plugin loops and yields to check `cancellationToken.isCancelled`. On `onUnload()`, it blocks until active work safely resolves or aborts.

## Execution Flow
1. Receives command.
2. Registers a tracked Promise simulating a 5-second IO/CPU operation.
3. Every 500ms, it verifies the global cancellation token.
4. If SIGINT is caught by the host, `onUnload()` is triggered, the token is flipped to cancelled, and the task rejects early.

## Expected Output
If uninterrupted:
```json
{ "success": true, "id": "task-xyz", "status": "completed" }
```
If interrupted:
```
Error: Cancelled by runtime
```

## Files
- `manifest.json`: Defines capability.
- `index.ts`: Implementation of graceful exit logic.
- `package.json`: Dependency declaration.

## Extension Points
Instead of a simulated `setTimeout`, use `fetch()` with an `AbortSignal` tied to the plugin context's cancellation token.

## Common Mistakes
- Ignoring `onUnload()` and leaving open sockets, hanging the Node process from exiting cleanly.

## Next Steps
Use these concepts to build complex agents that can safely be suspended and recovered using CRTX's SQLite architecture.
