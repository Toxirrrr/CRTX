---
name: prisma-patterns
description: Prisma repository conventions for this backend — BaseRepository.scope, soft-delete, SELECT consts, paginated $transaction, delta-sync, and schema/model rules. Use when writing *.repository.ts, prisma/schema.prisma, or migrations.
---

# Prisma Patterns (Agent Ops Platform)

`PrismaService` is injected **only** into `*.repository.ts`. Every repository extends `BaseRepository`.

## Tenant scoping + soft-delete (every query)
- Scope every query: `this.scope(organizationId)` (adds `where: { organizationId }`).
  SUPER_ADMIN has a home `organizationId` too and is scoped like any other user (D022) —
  `scope()`/`scopeActive()` now throw if `organizationId` is falsy. Cross-org access uses an
  explicit `findAllAcrossOrgs()`-style method, never an empty/undefined scope.
- Reads filter `deletedAt: null`. **Never hard-delete** — set `deletedAt`.
- Delta-sync: list endpoints support `?updatedAfter=ISO8601`; when present, **omit** the `deletedAt` filter so clients see soft-deleted records.

## SELECT discipline
- Top-level `const XXX_SELECT = {...} as const` per repository. Never inline selects.
- Never return raw Prisma models or `passwordHash`.

## Pagination
Every paginated list query uses `$transaction([findMany, count])` (one round trip).

## Schema / model rules
Every model:
```prisma
id            String    @id @default(cuid())
organizationId String   @map("organization_id")
createdAt     DateTime  @default(now()) @map("created_at")
updatedAt     DateTime  @updatedAt @map("updated_at")
deletedAt     DateTime? @map("deleted_at")
@@index([organizationId])
@@map("plural_snake")
```
- Models PascalCase, fields camelCase → `snake_case` columns via `@map`, tables `@@map("plural_snake")`.
- Statuses are Prisma **enums** with transitions in services (state machines), not free strings.
- Composite descending indexes for time-series: `@@index([agentId, recordedAt(sort: Desc)])` — index what you filter/sort on.
- **PostGIS geometry columns are NOT in the schema** — add via raw SQL migrations (`geometry(Point, 4326)`), query with `$queryRaw` (`ST_Distance`, `ST_DWithin`).
- `InventoryNode` is polymorphic: optional FKs `storeId? @unique`, `warehouseId? @unique`, `vehicleId? @unique` + `type` discriminator.
