# Architecture Freeze State

## Architecture Status: FROZEN

The CRTX Runtime v1.0 architecture is officially frozen. The project has moved from an infrastructure expansion phase into a product completion phase. The current microkernel and single-node SQLite architecture meets all requirements for the v1 release.

### Allowed Changes

*   **Bug Fixes**: Resolving defects in existing implementations.
*   **Performance Improvements**: Optimizing existing workflows (e.g., query tuning).
*   **Documentation**: Expanding README, Quick Start, and CLI Reference.
*   **UX / Developer Experience (DX)**: Improving error messages, CLI output, and fail-fast behaviors.
*   **CLI Polish**: Refining commands (`init`, `start`, `doctor`, `backup`, `create-plugin`).
*   **SDK Examples**: Adding examples for building and consuming plugins.

### Forbidden

*   **New Architecture**: No major redesigns of the execution lifecycle or core contracts.
*   **New Runtime Layers**: Do not introduce distributed runtimes, clustered orchestrators, or message bus layers.
*   **New Storage Backends**: SQLite is the **only** supported backend. PostgreSQL, Redis, and others are explicitly out of scope for v1.
*   **New Execution Pipeline**: The `Event -> Orchestrator -> Planner -> Scheduler -> Pipeline -> Dispatcher` flow is finalized.
*   **Public API Breaking Changes**: The `@crtx/sdk` interfaces must remain stable for plugin authors.

This freeze protects the project from infinite architectural refactoring and ensures focus remains on a stable, out-of-the-box user experience.
