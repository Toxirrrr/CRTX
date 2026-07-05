# CRTX Runtime v1.0

CRTX is a minimal, production-ready, single-node execution runtime for autonomous agents and workflows. Built with a focus on simplicity, Developer Experience (DX), and reliability.

## Features
- **Zero-Config Startup**: `crtx init` and `crtx start` gets you running in under a minute.
- **SQLite Persistence**: Fully relational, transactional, local-first storage using WAL mode. No external databases required.
- **Auto-Recovery**: Built-in `BootManager` automatically handles Warm Restarts and Crash Recoveries.
- **Plugin System**: Automatic discovery and loading of plugins via directory scanning.
- **CLI Management**: Native commands for health checks, backups, and scaffolding new plugins.

## Documentation
- [Quick Start](docs/QUICK_START.md)
- [CLI Reference](docs/CLI_REFERENCE.md)
- [Plugin Development Guide](docs/PLUGIN_GUIDE.md)

## Installation
Currently, CRTX is deployed locally via Node.js:
```bash
git clone <repository> crtx-runtime
cd crtx-runtime
npm install
npm run dev
```

## Production Readiness
CRTX v1.0 is architecturally frozen and focused entirely on stability. It is specifically designed to avoid distributed systems complexity (No Redis, No PostgreSQL, No Kubernetes requirement). If you need a stable single-node agent orchestrator, CRTX is built for you.
