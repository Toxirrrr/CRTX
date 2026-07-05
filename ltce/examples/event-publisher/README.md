# Event Publisher Plugin

## Purpose
Show how plugins securely publish domain events to the Runtime EventBus.

## Architecture
Requires the `"EventBus:Publish"` permission. It interacts with the `PluginContext.eventPublisher` to emit an `EventEnvelope`.

## Execution Flow
1. A command is routed to the plugin's `execute()` method.
2. The plugin finishes processing and constructs an `EventEnvelope`.
3. It calls `publish()` on the `eventPublisher`, passing the event.
4. The Core routes the event to any subscribed telemetry, logging, or infrastructure systems.

## Expected Output
```
Processing command XYZ-123. Emitting domain event.
```

## Files
- `manifest.json`: Defines the `EventBus:Publish` permission.
- `index.ts`: Implements the publishing logic.
- `package.json`: Dependency declaration.

## Extension Points
Use the event publisher to emit audit trails, custom telemetry marks, or inter-plugin communication packets.

## Common Mistakes
- Omitting the `EventBus:Publish` permission in the manifest, causing `publish()` to throw an authorization error.
- Forgetting to wait for the `Promise<EventPublishResult>`.

## Next Steps
Look at the `scheduler-example` to see how to trigger logic without waiting for commands.
