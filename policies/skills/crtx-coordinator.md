---
trigger: always_on
description: Enforces CRTX Multi-Agent Coordinator check-in before modifying files.
---

# CRTX Multi-Agent Coordinator Rule

**CRITICAL CONSTRAINT:**

All agents must coordinate their work via the CRTX Multi-Agent Coordinator before starting implementation, modifying files, or marking tasks as closed.

The Coordinator ensures that multiple AI coding agents do not overlap, conflict, or duplicate work.

## API Base URL
`http://localhost:4100/api/coordinator`

## 1. Claiming a Task (Mandatory Before Implementation)

Before you modify ANY file in the workspace, you MUST claim the task.

```bash
curl -X POST http://localhost:4100/api/coordinator/tasks/claim \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "YOUR_TASK_ID",
    "title": "Brief task title",
    "description": "Brief description",
    "chatId": "YOUR_CONVERSATION_ID",
    "agent": "YOUR_AGENT_NAME",
    "intent": "IMPLEMENT",
    "scope": { "directories": ["path/to/modify/**"], "files": ["specific/file.ts"] }
  }'
```
- If the response is `ok: true`, you have acquired the locks and can proceed.
- If you get `conflictType: 'DUPLICATE_TASK'` or `RESOURCE_CONFLICT`, another agent is working on it. **STOP IMMEDIATELY**. You may only perform `READ` actions. Do not mutate files.

## 2. Dependencies (If applicable)

If your task depends on another task, specify it during claim:
```json
"dependencies": ["TASK_A_ID"]
```
If TASK_A is not `CLOSED`, you will get a `DEPENDENCY_BLOCK` conflict. Do not proceed with implementation.

## 3. Submitting Evidence and Closing Task

Before concluding your task, you MUST submit validation evidence to close it. You cannot just say "I am done".

```bash
curl -X POST http://localhost:4100/api/coordinator/tasks/YOUR_TASK_ID/validate \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "YOUR_CONVERSATION_ID",
    "filesChanged": ["file1.ts"],
    "unitTestsPassed": true,
    "scopeVerified": true,
    "architectureVerified": true,
    "notes": "Finished feature X"
  }'
```

After successful validation, mark it as `CLOSED`:
```bash
curl -X POST http://localhost:4100/api/coordinator/tasks/YOUR_TASK_ID/release \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "YOUR_CONVERSATION_ID",
    "phase": "CLOSED"
  }'
```

## 4. Conflict Resolution

If you encounter an architectural conflict or need the Master Architect:
Call `/api/coordinator/conflicts` to see open conflicts, and if instructed by the user, you can resolve them via `/conflicts/:conflictId/resolve`.

## STRICT ENFORCEMENT

- Do NOT implement features without claiming the task in the Coordinator first.
- If ownership is denied, FAIL CLOSED.
- Always provide your conversation ID (`chatId`) so your locks are tracked properly.
