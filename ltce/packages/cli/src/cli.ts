#!/usr/bin/env node

import { CLICommands } from './commands';

const [,, command, ...args] = process.argv;
const baseDir = process.cwd();

switch (command) {
    case 'init':
        CLICommands.init(baseDir);
        break;
    case 'start':
        CLICommands.start(baseDir);
        break;
    case 'stop':
        CLICommands.stop(baseDir);
        break;
    case 'status':
        CLICommands.status(baseDir);
        break;
    case 'doctor':
        CLICommands.doctor(baseDir);
        break;
    case 'backup':
        CLICommands.backup(baseDir);
        break;
    case 'restore':
        if (args.length < 1) {
            console.error("Usage: crtx restore <backup_file>");
            process.exit(1);
        }
        CLICommands.restore(baseDir, args[0]);
        break;
    case 'create-plugin':
        if (args.length < 1) {
            console.error("Usage: crtx create-plugin <plugin-name>");
            process.exit(1);
        }
        CLICommands.createPlugin(baseDir, args[0]);
        break;
    default:
        console.log(`
CRTX Runtime CLI

Usage:
  crtx init                - Initialize runtime.json and directory structure
  crtx start               - Boot the CRTX runtime
  crtx stop                - Stop the running runtime
  crtx status              - Check runtime and database status
  crtx doctor              - Diagnose configuration and environment
  crtx backup              - Backup the SQLite database
  crtx restore <file>      - Restore the SQLite database from a backup file
  crtx create-plugin <name>- Generate a new plugin template
`);
        process.exit(1);
}
