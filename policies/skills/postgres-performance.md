---
name: postgres-performance
description: PostgreSQL + PostGIS performance patterns for this backend — indexing strategy, time-series composite indexes, paginated transactions, and spatial queries. Use when adding indexes, writing heavy/list/analytics queries, or PostGIS proximity lookups.
---

# Postgres / PostGIS Performance (Agent Ops Platform)

## Index what you actually filter/sort on
- Every tenant model: `@@index([organizationId])`.
- Time-series lookups: composite **descending** indexes — `@@index([agentId, recordedAt(sort: Desc)])`, `@@index([entityId, createdAt(sort: Desc)])`. Match the index column order to the query's WHERE + ORDER BY.
- Don't over-index writes-heavy tables (GPS points, StockMovement) — index only real query paths.

## Lists & pagination
- `$transaction([findMany, count])` for every paginated list — single round trip.
- Avoid N+1: prefer a scoped `select`/`include` over per-row fetches.

## PostGIS spatial
- Geometry columns (`geometry(Point, 4326)`) live in **raw SQL migrations**, not the Prisma schema.
- Add a **GiST spatial index** on geometry columns used for proximity.
- Query proximity with `$queryRaw` using `ST_DWithin` (bounded radius, index-friendly) rather than computing `ST_Distance` over the whole table:
```sql
WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $meters)
```
- Use `::geography` for meter-based distance; `ST_DWithin` short-circuits with the spatial index.

## General
- Throughput-sensitive writes (tracking ingest) go through Redis + BullMQ, never blocking the request thread — Postgres persistence is async.
- Validate query plans on hot paths with `EXPLAIN ANALYZE` when in doubt.
