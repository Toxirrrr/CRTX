# Backup & Recovery

CRTX Runtime ensures durability using a single-node SQLite instance with Write-Ahead Logging (WAL).

## Crash Recovery
The `BootPolicy` system automatically handles unclean shutdowns. When `crtx start` is invoked, the `BootManager` analyzes the database state. If an active execution graph is found without a proper shutdown signal, the `RecoveryService` is invoked to restore state.

## Manual Backups
You can safely backup the database while the runtime is active without locking the execution pipeline.
```bash
npx crtx backup
```
This generates a point-in-time snapshot of `data/runtime.db`.

## Restoring Backups
**Do not restore a backup while the runtime is running.**

1. Stop the runtime (`Ctrl+C` / `SIGINT`).
2. Run the restore command:
   ```bash
   npx crtx restore my-backup-file.db
   ```
3. Restart the runtime (`npx crtx start`).
