---
name: production-readiness
description: Definition-of-done and hardening gate for this platform — reality-first validation, No-Fake-UI policy, priority order, regression-neighbor checks, risk classification, and the full propagation chain. Use before declaring any task complete or when reviewing a change for completeness.
---

# Production Readiness (Agent Ops Platform)

Current phase is **hardening/stabilization** — no new product features without explicit human approval. Priority: stability, security, realtime integrity, tenant isolation, memory/CPU safety, DB indexing, WS clustering, browser-confirmed functionality.

## Definition of done (reality-first)
A task is done only when a human can use the feature end-to-end in a **live browser**: realtime updates propagate without reload, data survives a reload, no dead UI/fake data, and no neighboring system regressed.
**TypeScript passing, build succeeding, lint passing are prerequisites — never proof of completion.** "If the browser disagrees with the code, the browser wins. Always."

## Priority order (never fix lower before higher)
P1 broken functionality > P2 broken realtime > P3 broken CRUD > P4 dead UI/architecture > P5 visual polish.

## No-Fake-UI policy (P4)
Actively detect/remove dead buttons, placeholder widgets, fake metrics, disconnected analytics, frontend-only operational state, mock data, "Coming Soon" screens.

## Regression scope is always wider than the fix
When fixing entity X, check X's CRUD, Drawer, Map layer, Socket, and assignment/relationship flows, **plus the 2 nearest neighboring modules**.

## Propagation chain (confirm every link)
`Schema → Migration → DTO → Service → Controller → Pinia Store → Socket → Map Layer → Drawer → Browser`. A broken link anywhere is a VIOLATION.

## Risk classification (scrutiny scales with risk)
LOW (pure typing) / MEDIUM (null checks, collection ops) / HIGH (loops, assignments, sorting, routing, realtime) / CRITICAL (inventory, billing, RBAC, operational routing, schema changes). CRITICAL gets the most scrutiny regardless of diff size.

## Architecture changes require human approval
Category-C — breaking API contracts, WebSocket event-name changes, DB column changes — halt until the human decides. Agents flag architectural risk; they never decide it.
