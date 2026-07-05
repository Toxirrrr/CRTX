---
name: nestjs-architecture
description: NestJS layering, guard stack, DTO contract. Use when editing any controller, service, module or endpoint in server/src/modules/.
---
Layer order (never skip): `Controller → Service → Repository`
- Controller: HTTP routing + DTO binding + Swagger only. No business logic, no Prisma.
- Service: business logic, state machines, cross-module coordination. No Prisma, no HTTP.
- Repository: only place `PrismaService` is injected. Must extend `BaseRepository`.

Guard stack (every controller, order matters):
```ts
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Roles(Role.MANAGER, ...)
```
`JwtAuthGuard` → `OrganizationGuard` (checks `organizationId`, applies to SUPER_ADMIN too per D022) → `RolesGuard`. No reordering, no unauthenticated routes.

DTOs: class-validator + class-transformer on every input. `@ApiProperty()` on every field. Write DTO before service.
IDs: `cuid()` only — no `autoincrement()`, no raw UUID.
Responses: `ResponseInterceptor` → `{success,data}`. Never wrap manually.
Strict TS: no `any`, no `@ts-ignore`, explicit return types on public methods. No `console.log`.
API prefix: `api/v1` only. Never create `/api/v2`.
Change propagation: `Schema→Migration→DTO→Service→Controller→Store→Socket→Map→Drawer→Browser`. A broken link is a violation.
