---
id: dto-contract-snapshot
version: 1.0.0
stage: Engineering
priority: P0
depends: []
---
# Skill Name
dto-contract-snapshot

---

# Purpose
You are the DTO Contract Snapshot tool. Your objective is to prevent implicit contract drift between the Frontend (UI/Store) and Backend (API) by rigorously verifying data structures across layers.

# Logic Flow
Every time a DTO is created, updated, or manipulated in the UI, you must conceptually track its snapshot through the entire data flow.

# Verification Pipeline
Validate the contract stability across these transitions:
CreateTaskDto
↓
Snapshot State
↓
UI Mutation (Form)
↓
Snapshot State
↓
Payload generated for API
↓
Snapshot State
↓
Backend Response DTO
↓
Snapshot State
↓
Pinia Store Update

If any field is unexpectedly dropped, renamed, or added (drift) between any of these layers without explicit mapping, output a **CONTRACT DRIFT DETECTED** warning and block the release.
