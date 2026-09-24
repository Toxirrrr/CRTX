---
name: crtx-branch-guardian
description: "Active workspace and branch monitor. Integrates with CRTX to detect, resume, or abort abandoned AI work on branches."
---

# CRTX Branch Guardian

**CRITICAL CONSTRAINT:**
This is an active workspace monitoring skill. It ensures that no AI agent silently abandons a branch, leaves dirty working trees, or holds dead locks in the CRTX Coordinator.

## 1. Trigger Conditions
You MUST activate this skill immediately when:
1. You start a new session or wake up in an existing conversation.
2. The user asks "status" or "what is left".
3. You are about to switch branches or start a new task.

## 2. Detection Protocol (The 3 Checks)

Before starting any new work, you MUST execute the following checks:

### Check A: Git Status
```bash
git status
```
- If there are uncommitted changes, staged files, or untracked files from previous AI work, **STOP**.
- You must report: "⚠️ ОБНАРУЖЕНЫ НЕЗАКОНЧЕННЫЕ ИЗМЕНЕНИЯ НА ВЕТКЕ (UNCOMMITTED CHANGES)."

### Check B: Branch History
```bash
git log -n 3 --oneline
```
- Understand the context of the current branch. Is it a feature branch? A cycle branch? 

### Check C: CRTX Coordinator Locks & Stale Tasks
Run the CRTX CLI tool to check for stale or orphaned locks.
```bash
cd crtx && npm run guardian
```
- If the tool reports stale tasks or orphaned locks, **STOP**.
- You must report: "⚠️ ОБНАРУЖЕНА НЕЗАКРЫТАЯ ИЛИ УСТАРЕВШАЯ ЗАДАЧА В CRTX."

## 3. Resolution Protocol

If any of the detection checks find abandoned work, you MUST NOT start new work. Instead, prompt the user with a decision matrix:

**Option 1: Продолжить (Continue / RESUME)**
- "Хотите, чтобы я завершил эту работу, протестировал и закоммитил изменения, закрыв задачу в CRTX?"
- If user says yes: Run `npm run guardian -- resume YOUR_CHAT_ID` inside `/crtx`, then finish the implementation, validate, and commit.

**Option 2: Отменить (Abort/Revert)**
- "Хотите, чтобы я откатил эти изменения (`git reset --hard && git clean -fd`) и освободил CRTX лок, чтобы начать с чистого листа?"
- **CRITICAL**: You MUST NOT execute `git reset`, `git clean`, or any other destructive command unless the user explicitly types "yes", "revert", or "отменить".
- If user gives explicit permission: Revert the tree. To cancel the CRTX lock, run `npm run guardian -- abort YOUR_CHAT_ID` inside `/crtx`.

**Option 3: Оставить как есть (Leave & Ignore)**
- If the user explicitly says to ignore it (because another agent is actively working on it in another chat), you must NOT touch the files.

## 4. Agent Mandate
Never ignore a dirty tree. If you forgot your previous work, this skill acts as your memory. If another AI died mid-task, this skill acts as the cleanup crew, directly integrating with CRTX's CLI guardian.
