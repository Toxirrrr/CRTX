import { SQLiteDriver } from "../SQLiteDriver";
import { SQLiteSerializer } from "../SQLiteSerializer";
import { SchedulerSnapshot } from "../../../sdk/src/persistence";

export class ScheduleRepository {
    constructor(
        private readonly driver: SQLiteDriver,
        private readonly serializer: SQLiteSerializer
    ) {
        this.driver.execute(`
            CREATE TABLE IF NOT EXISTS scheduler_snapshots (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data TEXT NOT NULL
            )
        `);
    }

    save(snapshot: SchedulerSnapshot): void {
        const data = this.serializer.serializeSchedule(snapshot);
        this.driver.execute(
            `INSERT OR REPLACE INTO scheduler_snapshots (id, data) VALUES (1, ?)`,
            [data]
        );
    }

    get(): SchedulerSnapshot | null {
        const row = this.driver.queryOne<{ data: string }>(
            `SELECT data FROM scheduler_snapshots WHERE id = 1`
        );

        if (!row) return null;

        return this.serializer.deserializeSchedule(row.data);
    }
}
