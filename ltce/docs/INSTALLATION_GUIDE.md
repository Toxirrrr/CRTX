# Installation Guide

## Requirements
- Node.js v18.x or v20.x (LTS recommended)
- Access to a package manager (`npm`, `pnpm`, or `yarn`)

## Global Installation (CLI Only)
To use the CRTX CLI across multiple projects:
```bash
npm install -g @crtx/cli
```

## Local Installation (Recommended)
For dedicated projects, install the CLI locally:
```bash
mkdir my-agent-platform
cd my-agent-platform
npm init -y
npm install @crtx/cli @crtx/sdk
```

## First Boot
Run the initialization command:
```bash
npx crtx init
```
This generates the initial filesystem layout:
- `/data/runtime.db`: The SQLite WAL database file.
- `/plugins/`: The auto-discovery folder for plugins.
- `runtime.json`: The core configuration file.

## Testing Your Installation
Copy an example from the official examples to test:
```bash
npx crtx create-plugin test-plugin
npx crtx start
```
You should see the runtime boot cleanly and auto-discover the generated `test-plugin`.
