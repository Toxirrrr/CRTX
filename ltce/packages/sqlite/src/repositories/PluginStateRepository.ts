import { SQLiteDriver } from "../SQLiteDriver";
import { SQLiteSerializer } from "../SQLiteSerializer";
import { PluginSnapshot } from "../../../sdk/src/persistence";

export class PluginStateRepository {
    constructor(
        private readonly driver: SQLiteDriver,
        private readonly serializer: SQLiteSerializer
    ) {
        this.driver.execute(`
            CREATE TABLE IF NOT EXISTS plugin_snapshots (
                plugin_id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
        `);
    }

    save(pluginId: string, state: PluginSnapshot): void {
        const data = this.serializer.serializePluginState(state);
        this.driver.execute(
            `INSERT OR REPLACE INTO plugin_snapshots (plugin_id, data) VALUES (?, ?)`,
            [pluginId, data]
        );
    }

    get(pluginId: string): PluginSnapshot | null {
        const row = this.driver.queryOne<{ plugin_id: string, data: string }>(
            `SELECT plugin_id, data FROM plugin_snapshots WHERE plugin_id = ?`,
            [pluginId]
        );

        if (!row) return null;

        return this.serializer.deserializePluginState(row.plugin_id, row.data);
    }

    getAll(): PluginSnapshot[] {
        const rows = this.driver.query<{ plugin_id: string, data: string }>(
            `SELECT plugin_id, data FROM plugin_snapshots`
        );
        return rows.map(row => this.serializer.deserializePluginState(row.plugin_id, row.data));
    }
}
