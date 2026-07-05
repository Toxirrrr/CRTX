---
name: backend-security
description: Security audit rules — tenant isolation, RBAC, mass-assignment, audit logs, WebSocket scope, secrets. Use when adding/reviewing any endpoint, query, gateway, or auth flow. Security is a mandatory pipeline stage.
---
Feature is incomplete until security audit passes.

Tenant isolation (every query): `findMany({where:{organizationId}})`. No filter = rejection. Scope: API, Sockets, Analytics, Exports, Search, Reports. The architecture is strictly separated into Platform Context (for PLATFORM_OWNER) and Organization Context (for tenants). These contexts must NEVER overlap. 
Platform endpoints are prefixed with `/platform/` and protected by `PlatformGuard`. Organization endpoints are prefixed with `/app/` and protected by `OrganizationGuard`.

RBAC: roles `PLATFORM_OWNER>ORGANIZATION_ADMIN>OPERATIONS_MANAGER>DISPATCHER>AGENT`. Every endpoint defines Create/Read/Update/Delete/Assign/Approve. Undefined permissions = reject. Guard stack: `@UseGuards(JwtAuthGuard,OrganizationGuard,PermissionsGuard)` for tenants.

Input: DTO validation on every input. Mass assignment `{"role":"PLATFORM_OWNER"}` via public endpoint = rejection. Validate ownership + rate limiting on every route.

Audit logs (required): Create/Delete Driver, Delete Store, Assign Vehicle, Approve Replenishment, Inventory Adjustment. Fields: Actor, Organization, Timestamp, Action, Entity, Before, After.

Inventory: `StockMovement` is immutable — no deletes. Mutations need audit logs + permissions.

WebSocket: validate JWT + room membership + org scope. Cross-org leakage = rejection.

Secrets: `JWT_SECRET`/`JWT_REFRESH_SECRET` from env, checked on startup. Never log tokens/hashes. Never hardcode secrets or DB/Redis URLs.

OWASP: Broken Access Control, Crypto Failures, Injection, Insecure Design, Misconfiguration, Vulnerable Components, Auth Failures, SSRF, CSRF, XSS.
