# Plugin SDK Guide

CRTX uses a dynamic plugin system to extend capabilities. Plugins are automatically discovered from the `plugins/` directory.

## Canonical Examples
Before writing a plugin, review the official examples:
- [hello-world](../examples/hello-world) - Minimum requirements.
- [scheduler-example](../examples/scheduler-example) - Background tasks.
- [event-publisher](../examples/event-publisher) - Emitting events.
- [configuration-reader](../examples/configuration-reader) - Reading from `runtime.json`.
- [storage-example](../examples/storage-example) - Accessing SQLite.
- [long-running-task](../examples/long-running-task) - Graceful shutdown.

## The Plugin Class
Your `index.ts` must export a default class that implements `Plugin`. See the `hello-world` example for the baseline structure.

### Lifecycle Hooks
- `onLoad(ctx: PluginContext)`: Called when the plugin boots. Used for setting up intervals (see `scheduler-example`) or grabbing configuration (see `configuration-reader`).
- `onUnload()`: Called during shutdown. You must clear intervals and wait for pending tasks (see `long-running-task`).

### Execution
The `execute(command, ctx)` method is the primary entry point for routed work. It is invoked when the `Dispatcher` routes a command matching your plugin's `Capabilities`.

### Emitting Events
If your plugin needs to broadcast information, use `ctx.eventPublisher.publish()`. See the `event-publisher` example for the required `EventBus:Publish` permissions and syntax.
