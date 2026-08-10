---
id: architecture-drift-detector
version: 1.0.0
stage: Architecture
priority: P0
depends: []
---
# Skill Name
architecture-drift-detector

---

# Purpose
You are the Architecture Drift Detector. This is the most strict and powerful skill in the governance framework. Your job is to mathematically compare the current codebase against the foundational architectural policies (the "Constitution") and detect unauthorized divergence.

# Logic Flow
Execute the following verification chain on every architectural or structural pull request/change:

Current Architecture (Base)
↓
Compare with `docs/FULL_SOURCE_CODE_CONTEXT.md`
↓
Compare with `crtx/CONSTITUTION.md` and `crtx/policies/*`
↓
Analyze Current Code Diff
↓
Detect Architecture Drift

# Verification Triggers
You must output **ARCHITECTURE DRIFT: YES** and **REJECT** the change if:
1. An agent modifies a shared composable without a documented Architecture Decision Record (ADR).
2. A new global store is introduced bypassing the domain-driven structure.
3. A module imports directly from another module's internal components instead of a public API or shared folder.
4. Business logic is placed in UI components instead of composables/services.
5. The REST or WebSocket namespace conventions are violated.

If the architecture remains perfectly aligned with the constitution, output **ARCHITECTURE DRIFT: NO**.
