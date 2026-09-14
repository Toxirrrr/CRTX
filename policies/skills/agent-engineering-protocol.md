---
id: agent-engineering-protocol
version: 1.0.0
stage: Engineering
priority: P0
depends:
  - production-logic-auditor
  - backend-security
  - tenant-isolation
---
# Agent Engineering Protocol (AEP)

This skill is an ID-only reference. The full protocol lives at:

`crtx/AGENT_ENGINEERING_PROTOCOL.md`

## When to activate

Activate this skill for **every implementation task** — before writing a single line of code.

## Summary

AEP defines 11 mandatory gates (GATE 0–GATE 10) that insert into the existing CRTX MAEP lifecycle:

| Gate | Name | CRTX Phase |
|---|---|---|
| GATE 0 | SCOPE LOCK | READ-ONLY DISCOVERY |
| GATE 1 | READ-ONLY RECON | READ-ONLY DISCOVERY |
| GATE 2 | ACTUAL EXECUTION PATH | READ-ONLY DISCOVERY |
| GATE 3 | ROOT CAUSE | ANALYSIS |
| GATE 4 | FAILURE MODE MAP | ANALYSIS |
| GATE 5 | ACCEPTANCE CONTRACT | CYCLE PLAN |
| GATE 6 | MINIMAL IMPLEMENTATION | EXECUTION |
| GATE 7 | NEGATIVE TESTING | FINAL AUDIT |
| GATE 8 | ADVERSARIAL SELF-REVIEW | FINAL AUDIT |
| GATE 9 | FINAL EVIDENCE AUDIT | FINAL AUDIT |
| GATE 10 | HANDOFF TO MASTER ARCHITECT | FINAL AUDIT |

## P0 Blockers

Any of these conditions = BLOCKED, cannot handoff:

- Silent data loss (INPUT -> skip -> ACK -> data gone)
- ACK before durable write
- Cross-tenant data access
- Schema change without MA authorization
- Report does not match source code

## Read the full protocol

`crtx/AGENT_ENGINEERING_PROTOCOL.md`
