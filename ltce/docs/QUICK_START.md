# Quick Start

Get CRTX Runtime up and running in under 5 minutes.

## Prerequisites
- Node.js (v18 or newer)
- npm or pnpm

## 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repository> crtx-runtime
cd crtx-runtime
npm install
```

## 2. Initialization
Initialize the runtime environment. This command automatically creates the `runtime.json` configuration file, the `data/` directory for SQLite, and the `plugins/` directory:
```bash
npx crtx init
```

## 3. Verify Health
Ensure your environment is ready before starting:
```bash
npx crtx doctor
```

## 4. Add a Plugin
Copy the canonical `hello-world` example into your `plugins/` directory:
```bash
cp -r examples/hello-world plugins/
```

## 5. Start the Runtime
Boot the execution core:
```bash
npx crtx start
```
CRTX will automatically discover the `hello-world` plugin and print:
`HelloWorldPlugin has been loaded.`
