---
name: gps-tracking
description: End-to-end GPS tracking pipeline rules for this backend — point validation, Redis-then-queue ingestion, PostGIS persistence, and throttled org-scoped emit. Use when editing server/src/modules/tracking/, the tracking gateway, or the gps-persist processor.
---

# GPS Tracking Pipeline (Agent Ops Platform)

```
Mobile POST /api/v1/tracking/batch (≤100 points)
  → validate
  → Redis HASH write (sync, TTL 300s)        ← HTTP responds here
  → BullMQ enqueue (attempts:3, exp backoff)
  → worker persists to Postgres (PostGIS Point)
  → emit WS AFTER write, throttled ~2s/agent, org room
  → frontend useTrackingSocket → driverRegistry → MapLibre marker
```

## Validation (reject before ingest)
- Haversine distance sanity check between consecutive points.
- Reject `(0, 0)` coordinates.
- Reject implied speed `> 200 km/h`.
- Reject future timestamps and stale/too-old timestamps.
- Batch cap: ≤100 points per request.

## Ingestion ordering
- Write Redis HASH `agent:{id}:location` **synchronously**, TTL 300s (expiry = agent offline). HTTP responds after this write — **Postgres never blocks the request thread**.
- Persistence is async via BullMQ (`attempts:3`, exponential backoff).

## Persistence + emit
- Worker writes a PostGIS `Point` (geometry via raw SQL, not Prisma schema).
- **Emit only after the write succeeds**, throttled to ~1 emit per agent per ~2s, to the org-scoped tracking room — never global.

## Map side
Per-domain registries stay separate: `driverRegistry`, `salesAgentRegistry`, `storeRegistry`, `warehouseRegistry` — never merge.
