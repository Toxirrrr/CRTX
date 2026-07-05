---
name: backend
description: NestJS/Prisma/PostgreSQL patterns for server/**. Use for API endpoints, services, repositories, guards.
---
Stack: NestJS · Prisma · PostgreSQL+PostGIS · Redis 7 · BullMQ · Socket.io.
Flow: `Controller→Service→Repository`. Controllers: routing+DTO only. Services: logic. Repos: DB only.
Tenant isolation (every query): `findMany({where:{organizationId}})`. No org filter = reject.
Verify isolation: API, Sockets, Analytics, Exports, Search, Reports.
RBAC stack: `@UseGuards(JwtAuthGuard,OrganizationGuard,RolesGuard)` + `@Roles(...)` on every controller.
Roles: `SUPER_ADMIN>MANAGER>DISPATCHER/WAREHOUSE>AGENT`.
BaseRepository: all repos extend it. Use `scope(organizationId)`. No raw `prisma.*` in services.
API: `v1` only. Prefix: `api/v1/`. No v2 until prod+human approval.
DTO: class-validator+transformer on all inputs. Reject mass assignment (`{"role":"SUPER_ADMIN"}`).
Audit (required): Create/Delete Driver/Store, Assign Vehicle, Approve Replenishment, Inventory Adjustment. Fields: Actor,Org,Timestamp,Action,Entity,Before,After.
Inventory: StockMovement immutable (no delete). All mutations need audit+permissions.
Secrets: JWT from env only. Never log tokens/passwords. Never hardcode.
Done: `build`+`lint`+`test`+security audit (isolation+RBAC+audit logs+OWASP).
