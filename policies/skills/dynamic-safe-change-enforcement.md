---
trigger: always_on
name: Enforce Dynamic Safe Change
description: Forces AI agents to automatically apply the Dynamic Safe Change protocol when mutating production state or infrastructure.
---

# MANDATORY DYNAMIC SAFE CHANGE PROTOCOL

**CRITICAL CONSTRAINT:**

Whenever you are tasked with modifying the architecture, infrastructure, configuration, or production state (including Docker, PostgreSQL, Redis, Volumes, Queues, Nginx, or server topology) of the Agent Ops Platform, you **MUST AUTOMATICALLY** apply the `dynamic-safe-change` skill.

Do not wait for the user to explicitly ask you to use it.

## WHAT YOU MUST DO:
1. **Read the Protocol:** You must read the skill definition at `.agents/skills/dynamic-safe-change/SKILL.md` before making any changes.
2. **Follow the 11 Stages:** You must strictly follow the 11-stage protocol defined in the skill (from STAGE 0 Scope Lock to STAGE 11 Final Verdict).
3. **Read-Only First:** You must ALWAYS start with Read-Only Discovery (STAGE 1) to verify the factual runtime state. **Runtime Truth > Code Truth > Documentation Truth.**
4. **Pre-Mutation Recheck:** You must ALWAYS perform the Pre-Mutation Recheck (STAGE 7) immediately before executing any mutation.

If you discover that the factual runtime state differs from the expected documentation or configuration, you must follow the Drift Decision matrix defined in the skill.

**Never mutate the system assuming the documentation or docker-compose files perfectly reflect reality without proving it via runtime inspection first.**
