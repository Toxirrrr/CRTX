# ADR 001: Why Filesystem?

## Status
Accepted

## Context
AI agents need a shared state to coordinate complex tasks. Traditional workflow engines (like Temporal or Zapier) use centralized databases to store state. AI frameworks (like AutoGen or LangGraph) keep state in memory or proprietary databases during execution.

## Decision
CRTX uses the local filesystem (directories like `tasks/`, `evidence/`, `capsules/`) as the primary and ultimate source of truth for all orchestration state.

## Rationale
- **Universal Interoperability:** Every single AI coding tool (Cursor, Windsurf, Aider, Claude Code, GitHub Copilot) knows how to read and write files. Very few know how to connect to PostgreSQL natively.
- **Zero-Friction Onboarding:** Developers can inspect the exact state of a task pipeline simply by opening a JSON file in their IDE. No admin dashboards required.
- **Git-Native:** State can be committed, rolled back, diffed, and reviewed using standard Git workflows.

## Consequences
- Requires strict JSON schemas to prevent agents from corrupting file structures.
- Concurrency must be managed carefully if two agents attempt to write to the same `task.json` simultaneously.
