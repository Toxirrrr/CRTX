# Project Status

CRTX is continuously evolving. This document clarifies what is safe for production and what is still experimental.

## 🟢 Stable (Ready for Production)
The core specifications and protocols. You can safely build infrastructure on these.
- **The Filesystem Protocol**: `tasks/`, `evidence/`, `capsules/` schema.
- **Capability Routing Logic**: Decoupling tasks from specific models.
- **Local Runtime Initialization**: Standard CLI and workspace bootstrapping.

## 🟡 Experimental (Use with Caution)
Features currently undergoing testing. APIs may change.
- **LTCE Database Adapters**: The SQLite persistence layer for memory.
- **Cross-Agent Task DAGs**: Complex dependency resolution between tasks.

## ⚪ Planned (Not Yet Implemented)
Features on the roadmap but not yet available.
- **Standardized Webhook Events**: Emitting state changes to external systems (Slack, etc.).
- **Strict Schema Validation Enforcer**: Rejecting malformed capsules at the filesystem level.
