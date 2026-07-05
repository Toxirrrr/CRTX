import { SQLiteDriver } from "../SQLiteDriver";
import { SQLiteSerializer } from "../SQLiteSerializer";
import { ExecutionRecord } from "../../../sdk/src/persistence";

export class ExecutionRepository {
    constructor(
        private readonly driver: SQLiteDriver,
        private readonly serializer: SQLiteSerializer
    ) {
        this.driver.execute(`
            CREATE TABLE IF NOT EXISTS execution_records (
                command_id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                result TEXT,
                error TEXT
            )
        `);
    }

    save(record: ExecutionRecord): void {
        this.driver.execute(
            `INSERT OR REPLACE INTO execution_records (command_id, started_at, finished_at, result, error) VALUES (?, ?, ?, ?, ?)`,
            [
                record.commandId, 
                record.startedAt.toISOString(), 
                record.finishedAt ? record.finishedAt.toISOString() : null,
                this.serializer.serializeExecutionResult(record.result),
                record.error || null
            ]
        );
    }

    get(commandId: string): ExecutionRecord | null {
        const row = this.driver.queryOne<{
            command_id: string,
            started_at: string,
            finished_at: string | null,
            result: string | null,
            error: string | null
        }>(
            `SELECT command_id, started_at, finished_at, result, error FROM execution_records WHERE command_id = ?`,
            [commandId]
        );

        if (!row) return null;

        return {
            commandId: row.command_id,
            startedAt: new Date(row.started_at),
            finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
            result: this.serializer.deserializeExecutionResult(row.result),
            error: row.error || undefined
        };
    }
}
