# Frequently Asked Questions (FAQ)

### Can I use PostgreSQL or Redis?
No. CRTX Runtime v1.0 architecture is explicitly frozen on a single-node SQLite storage model to reduce infrastructure complexity. Distributed layers are forbidden.

### How do I listen to events?
In v1.0, plugins cannot directly subscribe to the `EventBus` via the `PluginContext`. Events are managed by the Core. Plugins can *publish* events. See the [event-publisher](../examples/event-publisher) example.

### How do I persist data?
Plugins do not open their own direct SQLite connections. Use standard capabilities or emit domain events. To understand the permissions model, see the [storage-example](../examples/storage-example).

### Can my plugin schedule work?
Yes. Plugins can use Node.js `setInterval` logic internally, provided they respect the `PluginContext.cancellationToken` and clean up during `onUnload()`. Review the [scheduler-example](../examples/scheduler-example).
