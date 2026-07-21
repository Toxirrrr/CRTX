# CRTX Runtime: Autonomous Cycle Engineering Migration Boundary

This document tracks the migration status of the CRTX platform from the legacy `Task` model to the new `Cycle` runtime model.

## Core Architectural Boundary

1. **`Cycle` (Runtime Domain)**
   - Used by: Engine, Scheduler, Memory, Watchdog.
   - Purpose: Represents the runtime execution state of an autonomous mission by an AI Agent.
   - Types: `Mission`, `Cycle`, `CycleState`, `CycleResult`, `CycleArtifact`.

2. **`Task` (Business/Legacy Domain)**
   - Used by: Prisma DB, API Routes, Dashboard UI, Logistics Business Logic.
   - Purpose: Represents the business definition of work that might be assigned to agents or humans.
   - Types: `AgentTask`, `AgentTaskInput`, Prisma `Task` model.

---

## Migration Rules

**Rule 1: Unidirectional Adapters Only**
- The new orchestration engine MUST use `Cycle`.
- When reading from legacy persistence (JSON files or DB), use `LegacyImporter` to map `Task` -> `Cycle`.
- When updating legacy persistence, use `LegacyExporter` to map `Cycle` -> `Task`. 
- **Under no circumstances should new code operate directly on `AgentTask`.**

**Rule 2: Forbidden Imports**
Modules migrated to the `Cycle` domain are **STRICTLY FORBIDDEN** from importing `AgentTask` directly. All boundaries must pass through `LegacyImporter` or `LegacyExporter`.

---

## Module Migration Status

| Module | Status | Allowed Models | Description |
|--------|--------|----------------|-------------|
| `orchestration/types.ts` | **Migrated** | `Cycle`, `Mission`, `Task` | Both models coexist. Base contracts. |
| `orchestration/CycleFactory.ts` | **Migrated** | `Cycle` | parse() + create(). Single source of truth for Cycle construction. |
| `orchestration/adapters` | **Migrated** | `Cycle`, `Task` | `LegacyImporter`, `LegacyExporter`. |
| `orchestration/router.ts` | **Migrated ✅** | `Cycle` only | 100% Cycle-pure. No `as Cycle` casts. Uses CycleFactory.parse()/create(). |
| `orchestration/ExecutionEngine.ts` | **Migrated ✅** | `ExecutionResult`, `ExecutionState` | No AgentTask. cycleId/taskId alias added. TODO: rename to cycleId post-migration. |
| `orchestration/watchdog.ts` | **Migrated ✅** | `WatchedTask` (own) | Reads CYCLES_DIR primarily, TASKS_DIR as legacy fallback. No AgentTask import. |
| `server.ts` | **Migrated ✅** | `Cycle` (new), `AgentTask` (legacy boundary) | `/api/cycles` endpoints added (Cycle-native). `/api/tasks` kept as legacy boundary. |
| `orchestration/server.ts` | N/A | — | server.ts is at src root, not orchestration subdir. |
| `coordination/boardStore.ts`| Not Started | `BoardTask` | Already reads `cycles/`. Minor: rename internal refs. |
| `memory/*` | Not Started | `AgentTask` | Legacy JSON parsing logic. |
| `Prisma Schema` | **FROZEN** | `Task` | Business domain. Never touch. |

---

## How to Migrate a Module
1. Create a branch or new cycle.
2. Replace all local usage of `AgentTask` inside the module with `Cycle`.
3. Locate where the module reads/writes to the outer system.
4. Inject `LegacyImporter.toCycle()` for incoming data.
5. Inject `LegacyExporter.toLegacyTask()` for outgoing data.
6. Verify via `build`, `typecheck`, and `tests`.
