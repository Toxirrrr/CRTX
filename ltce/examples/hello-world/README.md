# Hello World Plugin

## Purpose
The smallest possible CRTX plugin. Demonstrates the required `Plugin` interface, lifecycle hooks, and simple command execution.

## Architecture
Implements the `@crtx/sdk` `Plugin` interface. Uses the `Metrics` capability as a placeholder.

## Execution Flow
1. Discovered during `crtx start`.
2. `onLoad()` is invoked with `PluginContext`.
3. Dispatched commands matching `Metrics` capability invoke `execute()`.
4. `health()` is called periodically by the runtime.

## Expected Output
When a matching command is sent, the plugin will return:
```json
{
  "success": true,
  "message": "Hello World from CRTX Runtime v1.0!"
}
```

## Files
- `manifest.json`: Defines identity and capabilities.
- `index.ts`: The class implementing the `Plugin` contract.
- `package.json`: Dependency declaration.

## Extension Points
- Add capabilities to `manifest.json` and implement routing logic inside `execute()`.

## Common Mistakes
- Not exporting the class as `default`. The Bootstrapper expects a default export for the plugin class.

## Next Steps
Check out the `event-handler` example to see how to react to runtime events asynchronously.
