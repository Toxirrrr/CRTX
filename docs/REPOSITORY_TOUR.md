# Repository Tour

This document provides a high-level overview of the CRTX repository structure. 
No implementation details are discussed here—only the purpose of each directory.

- `packages/` — Shared libraries, SDKs, and types used across the CRTX ecosystem.
- `contracts/` — Cryptographic schemas and validation logic for `Task`, `Capsule`, and `Evidence` files.
- `sdk/` — Developer tools for interacting with the CRTX filesystem protocol programmatically.
- `runtime/` — The capability router and engine that dispatches work to AI providers.
- `memory/` — Storage adapters for capsules and architectural decision records (ADRs).
- `events/` — The telemetry journal tracking task lifecycles (Created -> Research -> Evidence -> Capsule -> Review).
- `examples/` — Self-contained scenarios demonstrating multi-agent handoffs and context recovery.
- `docs/` — Core architectural documents, design principles, and guidelines.
