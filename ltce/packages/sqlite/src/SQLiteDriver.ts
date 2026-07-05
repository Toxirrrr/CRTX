import Database from 'better-sqlite3';

export interface SQLiteDriver {
    execute(sql: string, params?: any[]): void;
    query<T>(sql: string, params?: any[]): T[];
    queryOne<T>(sql: string, params?: any[]): T | null;
    transaction<T>(action: () => T): T;
    close(): void;
}

export class BetterSQLiteDriver implements SQLiteDriver {
    private db: Database.Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
    }

    execute(sql: string, params: any[] = []): void {
        const stmt = this.db.prepare(sql);
        stmt.run(...params);
    }

    query<T>(sql: string, params: any[] = []): T[] {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params) as T[];
    }

    queryOne<T>(sql: string, params: any[] = []): T | null {
        const stmt = this.db.prepare(sql);
        const result = stmt.get(...params);
        return result !== undefined ? result as T : null;
    }

    transaction<T>(action: () => T): T {
        return this.db.transaction(action)();
    }

    close(): void {
        this.db.close();
    }
}
