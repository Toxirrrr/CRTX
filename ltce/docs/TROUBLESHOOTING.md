# Troubleshooting

## Process Hangs on Shutdown
If `Ctrl+C` does not cleanly exit the Node.js process, a plugin has likely left an open file handle, active socket, or unresolved `setInterval`.
- **Solution:** Review the [long-running-task](../examples/long-running-task) and [scheduler-example](../examples/scheduler-example) examples to ensure your plugin correctly clears intervals and awaits pending promises during `onUnload()`.

## `[FATAL] Invalid configuration`
The `runtime.json` file failed Zod schema validation.
- **Solution:** Ensure the JSON is well-formed. `logLevel` must be one of `debug`, `info`, `warn`, or `error`.

## Plugin Fails to Load
If `crtx start` ignores your plugin folder:
- **Solution:** Ensure the `manifest.json` is valid JSON and includes `id` and `version` fields. The Bootstrapper skips malformed directories silently with a warning.

## Database Locked
Occurs if multiple runtime instances try to mount `data/runtime.db` simultaneously.
- **Solution:** Ensure only one `crtx start` process is active. CRTX is a single-node runtime and does not support concurrent multi-process access to the same SQLite file.
