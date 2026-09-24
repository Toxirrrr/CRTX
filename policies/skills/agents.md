---
trigger: always_on
description: Enforces .agents/ as the single source of truth for agent skills and rules.
---

# Agent Configuration and Skills Deployment Rule

**CRITICAL CONSTRAINT:**

When installing, updating, or modifying AI agent skills, rules, and configurations in this repository, you **MUST** use a single source of truth.

## 1. The Single Source of Truth

The `.agents/` directory is the **primary and only real directory** for skills and rules:
* `.agents/skills/`
* `.agents/rules/`

## 2. Symlinks / Junctions

The folders `.codex/` and `.agent/` are intentionally configured as Windows Directory Junctions (symlinks) pointing directly to the `.agents/` directory.
* `.codex/skills` -> `.agents/skills`
* `.agent/skills` -> `.agents/skills`

## 3. Skill Installation Behavior

When an AI Agent is tasked with installing a new skill or updating an existing one:
1. **DO NOT duplicate installations**: You only need to install or configure the skill **once** in `.agents/skills/`.
2. **DO NOT overwrite or delete the junctions**: If you install something via `.codex/skills/`, it will automatically write to `.agents/skills/`. Do not delete `.codex/skills` to create a real directory.
3. **Unified (Obshi) Setup**: Use this single configuration. Any modifications applied to `.agents/` will instantly be available to `.codex/` and `.agent/` contexts.

Always respect this unified directory structure to prevent state drift and duplication between the different AI tooling folders.
