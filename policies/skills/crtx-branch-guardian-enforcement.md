# CRTX Branch Guardian Enforcement

**CRITICAL CONSTRAINT:**

Whenever you wake up, start a new session, or are asked for a status update, you **MUST AUTOMATICALLY** apply the `crtx-branch-guardian` skill.

Do not wait for the user to explicitly ask you to use it. 
This rule ensures that no AI agent silently abandons a branch, leaves dirty working trees, or holds dead locks in the CRTX Coordinator.

## WHAT YOU MUST DO:
1. **Read the Protocol:** You must read the skill definition at `.agents/skills/crtx-branch-guardian/SKILL.md`.
2. **Execute Detection:** Run `git status`, `git log`, and check the CRTX coordinator state to detect if there is any abandoned work, uncommitted files, or open locks on the current branch.
3. **Resolve:** If abandoned work is found, halt new work and present the user with the resolution matrix (Continue, Abort, or Leave) as defined in the skill. 
