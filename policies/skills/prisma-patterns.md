---
id: prisma-patterns
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
`PrismaService` injected only in `*.repository.ts`. All repos extend `BaseRepository`.

Tenant scoping (every query): `this.scope(organizationId)` adds `where:{organizationId}`. Throws if `organizationId` is falsy. SUPER_ADMIN is scoped too (D022). Cross-org access only via explicit `findAllAcrossOrgs()` + `role==='SUPER_ADMIN'` branch.

Soft-delete: reads filter `deletedAt:null`. Never hard-delete — set `deletedAt`.
Delta-sync: `?updatedAfter=ISO8601` → omit `deletedAt` filter so clients see soft-deleted records.

SELECT: define `const XXX_SELECT = {...} as const` at top of file. Never inline. Never return `passwordHash` or raw Prisma model.

Pagination: every list uses `$transaction([findMany, count])` — one round trip.

Schema rules for every model:
```prisma
id             String    @id @default(cuid())
organizationId String    @map("organization_id")
createdAt      DateTime  @default(now()) @map("created_at")
updatedAt      DateTime  @updatedAt @map("updated_at")
deletedAt      DateTime? @map("deleted_at")
@@index([organizationId])
@@map("plural_snake_case")
```
Models: PascalCase. Fields: camelCase → `@map("snake_case")`. Tables: `@@map("plural_snake")`.
Statuses: Prisma enums with transitions in services (state machines). Not free strings.
Time-series indexes: `@@index([agentId, recordedAt(sort:Desc)])`.
PostGIS geometry: NOT in schema — raw SQL migrations only (`geometry(Point,4326)`), queried with `$queryRaw`.
`InventoryNode`: polymorphic — optional FKs `storeId?@unique`, `warehouseId?@unique`, `vehicleId?@unique` + `type` discriminator.
