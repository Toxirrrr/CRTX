---
id: tenant-isolation
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# 🛡️ Tenant Isolation & RBAC Architecture

**CRITICAL:** Agent Ops Platform is a multi-tenant SaaS. Any data leak across tenants (organizations) is a P0 catastrophic failure.

## 1. Database & Prisma Filters
- **NEVER** write a Prisma query without `organizationId` (or `tenantId`) unless explicitly building a super-admin cross-tenant script.
- **Rule:** `where: { organizationId: req.user.organizationId }` must be present in every `findMany`, `findUnique`, `update`, and `delete`.

## 2. API Guards (@RequirePermissions)
- **EVERY** protected endpoint must be decorated with `@RequirePermissions()`.
- Example: `@RequirePermissions(Permissions.TASKS_READ)`
- Never rely solely on frontend hiding buttons; the backend must explicitly reject unauthorized requests.

## 3. JWT & Authentication
- Do not modify JWT signing logic or AuthGuards without explicit approval.
- Ensure all controllers extract the user context via `@User()` or `@Req()` and pass the tenant scope down to the service layer.
