# CRTX Runtime v1.0 - Official Plugin Examples

This repository contains the canonical reference implementations for building `@crtx/sdk` plugins.

## 🚀 Getting Started

The CRTX Runtime automatically discovers plugins placed in the configured `plugins/` directory (default). To run any of these examples:

1. Create a `plugins/` folder in your runtime environment.
2. Copy any example directory into the `plugins/` folder.
3. Start the runtime:
   ```bash
   npx crtx start
   ```

## 📚 Examples Overview

| Example | Purpose | Key SDK Features Demonstrated |
|---------|---------|------------------------------|
| [**hello-world**](./hello-world) | Minimum viable plugin. | `Plugin`, `manifest.json`, `execute()`, `health()` |
| [**scheduler-example**](./scheduler-example) | Background work loops. | `PluginContext`, `CancellationToken` |
| [**event-handler**](./event-handler) | Reacting to system events. | `EventPublisher`, `Permissions`, Event filtering |
| [**configuration-reader**](./configuration-reader) | Safe configuration parsing. | `PluginContext.config`, defaults, validation |
| [**storage-example**](./storage-example) | Persisting data. | Storage permissions, command execution context |
| [**long-running-task**](./long-running-task) | Graceful lifecycle control. | Tracked promises, `onUnload()`, graceful shutdown |

## 📐 Implementation Rules
All examples strictly adhere to the v1.0 Architecture Freeze:
- Imports use ONLY the public `@crtx/sdk`.
- Internal layers (Core, RuntimeHost, BootPolicy) are NEVER imported.
- No distributed or cluster concepts are introduced. All state assumes the v1.0 single-node SQLite engine.

## 🛠 Building Your Own
Generate a fresh plugin template instantly using the CLI:
```bash
npx crtx create-plugin my-awesome-plugin
```
