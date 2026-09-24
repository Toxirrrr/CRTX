# Mandatory Subagent Delegation Rule (CRTX Swarm)

**CRITICAL CONSTRAINT:**
Any agent assigned a task that can be logically partitioned MUST NOT execute the subtasks sequentially. You MUST delegate the work using the **1+2+3 Delegation Protocol**.

## Delegation Protocol (1+2+3)

### 1. CRTX Task Queue (Enterprise Isolation)
Before writing code, analyze the feature and break it down into independent subtasks (e.g., Frontend Component, Backend Service, Unit Tests).
- Register EVERY subtask in the CRTX Coordinator (`POST /api/coordinator/tasks`).
- If a subtask is massive or out of scope for the current sprint, leave its phase as `TODO` for external asynchronous workers to pick up later.

### 2. Native Antigravity Swarm (Parallel Execution)
For subtasks that must be completed now, you MUST act as an Orchestrator.
- Do NOT write the code for these subtasks yourself.
- Use the Antigravity `invoke_subagent` tool to spawn subagents for each subtask SIMULTANEOUSLY in a single tool call.
- Always use `Workspace: "share"` so subagents can work on the same repository without cloning overhead.
- Pass the specific CRTX `taskId` to each subagent so they can lock it.

### 3. Hybrid Model Routing (Pro vs Flash)
When calling `invoke_subagent`, you MUST select the most efficient model based on the subtask's complexity:
- **`Model: "pro"`**: Use for Core Architecture, Database Schemas, Authentication, or complex backend business logic.
- **`Model: "flash"`**: Use for writing unit tests, UI/CSS styling, documentation, codebase research, or simple CRUD boilerplate.
