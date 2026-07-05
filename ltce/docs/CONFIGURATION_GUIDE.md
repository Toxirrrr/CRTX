# Configuration Guide

CRTX configuration is managed via a Zod-validated `runtime.json` file in the root directory.

## Default Configuration
```json
{
  "sqlitePath": "data/runtime.db",
  "pluginDirectory": "plugins",
  "telemetryEnabled": true,
  "logLevel": "info"
}
```

## Plugin-Specific Configuration
Plugins can safely read from the `plugins` nested object within `runtime.json`.

Example `runtime.json`:
```json
{
  "plugins": {
    "configuration-reader": {
      "endpoint": "http://api.internal:8080",
      "retryLimit": 5
    }
  }
}
```

For a concrete implementation of parsing this dynamically, see the [configuration-reader](../examples/configuration-reader) example.

## Fail-Fast Behavior
If `runtime.json` is missing or invalid, the bootstrapper will output a `[FATAL]` error to the console and exit immediately. Run `crtx init` to restore default settings.
