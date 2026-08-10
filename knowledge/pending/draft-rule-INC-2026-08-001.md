---
id: learning-recommendation-INC-2026-08-001
sourceIncident: INC-2026-08-001
status: PENDING_HUMAN_APPROVAL
---

# Recommended Architectural Update
**Based on Incident:** Cross-tenant data leak in Live Map

## Analysis of Root Cause
The WsGateway for tracking emitted location updates to the global room instead of the org-specific room when the driver connection re-initialized after an offline period.

## Proposed New Rule / Anti-Pattern
> **RULE:** Any modifications to the following paths must be audited for this specific regression:
- `server/src/tracking/tracking.gateway.ts`
- `server/src/tracking/driver-location.service.ts`

## Action Required
If you approve this rule, move this file to `crtx/knowledge/anti-patterns.md` or update an existing skill in `crtx/policies/skills/`.
