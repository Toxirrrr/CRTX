---
name: backend-security
description: Mandatory security audit rules for this backend — tenant isolation, RBAC matrix, mass-assignment defense, audit logs, immutable inventory, WebSocket scope, and secrets handling. Use when adding/reviewing any endpoint, query, gateway, or auth flow. Security is a required pipeline stage, not optional.
---

# Backend Security (Agent Ops Platform)

A feature that compiles and works is **incomplete** until it passes security audit.

## Tenant isolation (every query on tenant-owned data)
- `prisma.store.findMany()` with no org filter → **rejection**.
- `prisma.store.findMany({ where: { organizationId } })` → required.
- Verify isolation across **API, Sockets, Analytics, Exports, Search, Reports** — not just CRUD.
- SUPER_ADMIN has a home `organizationId` and is scoped by this filter like any other user (D022) — there is no guard bypass. Genuine cross-org access is only via an explicitly named `findAllAcrossOrgs()`-style repository method plus an explicit `role === 'SUPER_ADMIN'` branch in the controller.

## RBAC
- Roles: `SUPER_ADMIN > MANAGER > DISPATCHER / WAREHOUSE > AGENT` (Driver/SalesAgent are AGENT-tier).
- Every endpoint defines Create/Read/Update/Delete/Assign/Approve explicitly. Reject undefined permissions.
- Triple-guard stack on every controller: `@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)` + `@Roles(...)`.

## Input / mass assignment
- DTO validation on every input. Reject mass assignment, e.g. `{ "role": "SUPER_ADMIN" }` through a public update endpoint.
- Validate ownership, rate limiting, authorization on every route.

## Audit logs (required for sensitive actions)
Create/Delete Driver, Delete Store, Assign Vehicle, Approve Replenishment, Inventory Adjustment, etc. Each entry: Actor, Organization, Timestamp, Action, Entity, Before, After.

## Inventory = financial asset
- Reject deleting `StockMovement`; reject mutations without audit logs or permission checks. Movement history is **immutable**.

## WebSocket
- Validate JWT, room membership, org scope, permission scope. Cross-org leakage = automatic rejection.

## Secrets
- `JWT_SECRET` / `JWT_REFRESH_SECRET` from env, validated on startup (app refuses to boot if missing).
- Never log tokens/passwords/refresh tokens; never expose password hashes; never hardcode secrets, URLs, or DB/Redis passwords.

## OWASP
Audit every change for Broken Access Control, Crypto Failures, Injection, Insecure Design, Misconfiguration, Vulnerable Components, Auth Failures, SSRF, CSRF, XSS.
