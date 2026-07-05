import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CLICommands } from '../src/commands';
import { ConfigManager } from '../src/config';

describe('CLI Commands E2E', () => {
    const testDir = path.join(__dirname, '.test_env');

    beforeEach(() => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('should initialize empty directory', () => {
        CLICommands.init(testDir);
        expect(fs.existsSync(path.join(testDir, 'runtime.json'))).toBe(true);
        expect(fs.existsSync(path.join(testDir, 'data'))).toBe(true);
        expect(fs.existsSync(path.join(testDir, 'plugins'))).toBe(true);
    });

    it('should run doctor successfully after init', () => {
        CLICommands.init(testDir);
        CLICommands.doctor(testDir);
        expect(console.log).toHaveBeenCalledWith("Environment is healthy and ready to run.");
    });

    it('should backup and restore sqlite database', () => {
        CLICommands.init(testDir);
        const config = ConfigManager.load(testDir);
        const dbPath = path.join(testDir, config.sqlitePath);
        
        // Mock a DB file
        fs.writeFileSync(dbPath, "fake sqlite data");

        // Backup
        CLICommands.backup(testDir);
        
        // Check if backup file was created
        const files = fs.readdirSync(path.join(testDir, 'data'));
        const backupFile = files.find(f => f.includes('.backup-'));
        expect(backupFile).toBeDefined();

        // Delete original and Restore
        fs.unlinkSync(dbPath);
        expect(fs.existsSync(dbPath)).toBe(false);

        CLICommands.restore(testDir, path.join('data', backupFile!));
        expect(fs.existsSync(dbPath)).toBe(true);
        expect(fs.readFileSync(dbPath, 'utf-8')).toBe("fake sqlite data");
    });

    it('should run status', () => {
        CLICommands.init(testDir);
        CLICommands.status(testDir);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Database Status:'));
    });
});
