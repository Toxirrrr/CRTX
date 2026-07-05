import { SQLiteDriver } from "../SQLiteDriver";
import { SQLiteSerializer } from "../SQLiteSerializer";
import { RuntimeSnapshot } from "../../../sdk/src/persistence";

export class SnapshotRepository {
    constructor(
        private readonly driver: SQLiteDriver,
        private readonly serializer: SQLiteSerializer
    ) {
        this.driver.execute(`
            CREATE TABLE IF NOT EXISTS runtime_snapshots (
                runtime_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                data TEXT NOT NULL
            )
        `);
    }

    save(snapshot: RuntimeSnapshot): void {
        const data = this.serializer.serializeRuntimeSnapshot(snapshot);
        this.driver.execute(
            `INSERT OR REPLACE INTO runtime_snapshots (runtime_id, created_at, data) VALUES (?, ?, ?)`,
            [snapshot.runtimeId, snapshot.createdAt.toISOString(), data]
        );
    }

    getLatest(plugins: any[], scheduler: any): RuntimeSnapshot | null {
        const row = this.driver.queryOne<{ runtime_id: string, created_at: string, data: string }>(
            `SELECT runtime_id, created_at, data FROM runtime_snapshots ORDER BY created_at DESC LIMIT 1`
        );

        if (!row) return null;

        return this.serializer.deserializeRuntimeSnapshot(row.runtime_id, row.created_at, row.data, plugins, scheduler);
    }

    getById(runtimeId: string, plugins: any[], scheduler: any): RuntimeSnapshot | null {
        const row = this.driver.queryOne<{ runtime_id: string, created_at: string, data: string }>(
            `SELECT runtime_id, created_at, data FROM runtime_snapshots WHERE runtime_id = ?`,
            [runtimeId]
        );

        if (!row) return null;

        return this.serializer.deserializeRuntimeSnapshot(row.runtime_id, row.created_at, row.data, plugins, scheduler);
    }
}
