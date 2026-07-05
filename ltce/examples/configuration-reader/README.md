# Configuration Reader Plugin

## Purpose
Show how plugins safely read and validate runtime configuration.

## Architecture
Injects `PluginContext.config` during the `onLoad` lifecycle hook to map global configuration variables to local plugin state.

## Execution Flow
1. User modifies `runtime.json` to include plugin-specific variables.
2. Runtime mounts and parses config via Zod.
3. Plugin accesses `ctx.config.plugins["configuration-reader"]`.
4. Plugin applies defaults if values are missing or typed incorrectly.

## Expected Output
On boot:
```
ConfigurationReaderPlugin initialized. Endpoint: http://localhost:8080, Retries: 3
```

## Files
- `manifest.json`: Plugin identity.
- `index.ts`: Implementation of config parsing.
- `package.json`: Dependency declaration.

## Extension Points
Integrate `zod` locally within your plugin to validate your nested configuration block instead of manual `typeof` checks.

## Common Mistakes
- Throwing a fatal error if config is missing. Plugins should always fail gracefully or provide sensible defaults.

## Next Steps
Look at the `storage-example` to learn how to persist dynamically configured data.
