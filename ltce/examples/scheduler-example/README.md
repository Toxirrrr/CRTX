# Scheduler Example Plugin

## Purpose
Demonstrate background scheduled execution managed safely alongside the plugin lifecycle.

## Architecture
This plugin creates a NodeJS `setInterval` loop in `onLoad()` that respects the runtime `CancellationToken`.

## Execution Flow
1. Discovered and loaded by the runtime.
2. `onLoad()` initializes a 10-second ticker.
3. Every 10 seconds, the ticker checks the cancellation token.
4. When the runtime shuts down, `onUnload()` clears the interval explicitly.

## Expected Output
In the runtime console, you will see a tick every 10 seconds:
```
SchedulerExamplePlugin: Scheduled tick fired.
```

## Files
- `manifest.json`: Defines capabilities.
- `index.ts`: The plugin class.
- `package.json`: Dependency declaration.

## Extension Points
Instead of just logging, use `ctx.eventPublisher` to emit a scheduled event back into the pipeline.

## Common Mistakes
- Forgetting to clear intervals in `onUnload()`, leading to memory leaks and hanging processes.

## Next Steps
Check out the `event-handler` plugin to see how to listen to the events this plugin could emit.
