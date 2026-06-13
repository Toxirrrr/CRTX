---
name: nestjs-architecture
description: NestJS layering rules for this backend — Controller → Service → Repository, the triple-guard stack, DTO/Swagger contract, and response wrapping. Use when adding/editing any controller, service, module, or endpoint under server/src/modules/.
---

# NestJS Architecture (Agent Ops Platform backend)

Strict layering — **never** skip a layer:
`Controller → Service → Repository`

- **Controller**: HTTP only (routing, guards, DTO binding, Swagger). No business logic, no Prisma.
- **Service**: business logic, state machines, cross-module orchestration. No Prisma, no HTTP concerns.
- **Repository**: the **only** place `PrismaService` is injected. Extends `BaseRepository`. No HTTP concerns.

## Every controller — triple guard + roles (order matters)
```ts
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Roles(Role.MANAGER, Role.DISPATCHER)
```
`JwtAuthGuard` (verify JWT) → `OrganizationGuard` (verify `organizationId` is present — applies to SUPER_ADMIN too, D022) → `RolesGuard` (check `@Roles`). No unauthenticated routes. No reordering.

## DTO + Swagger contract (mandatory)
- A DTO for every endpoint, validated with `class-validator` / `class-transformer`.
- Every DTO field: `@ApiProperty()`. Every endpoint: `@ApiOperation()` + `@ApiResponse()`.
- The DTO defines the contract **first** — write it before the service.

## Conventions
- IDs: `cuid()` — never `autoincrement()` or raw UUID.
- Responses are wrapped by `ResponseInterceptor` → `{ success, data }`. Don't wrap manually.
- Strict TypeScript: no `any`, no `@ts-ignore`, explicit return types on public methods.
- No `console.log`, no stub/fake endpoints — every endpoint does a real DB op.
- Global prefix is `api/v1` only — never create `/api/v2`.

## Propagation when an endpoint/entity changes
`Schema → Migration → DTO → Service → Controller → Pinia Store → Socket → Map Layer → Drawer → Browser`. A broken link is a VIOLATION, not a warning.
