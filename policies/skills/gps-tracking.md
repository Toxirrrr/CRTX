---
id: gps-tracking
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
Pipeline:
```
POST /api/v1/tracking/batch (≤100 points)
  → validate → Redis HASH write (sync, TTL 300s) ← HTTP responds here
  → BullMQ enqueue (attempts:3, exp backoff)
  → worker persists PostGIS Point (raw SQL)
  → emit WS AFTER write, throttled ~2s/agent, org room
  → useTrackingSocket → driverRegistry → MapLibre marker
```

Validation (reject before ingest): Haversine sanity check between consecutive points. Reject `(0,0)` coords. Reject implied speed >200km/h. Reject future timestamps and stale/old timestamps. Batch cap: ≤100 points.

Ingestion: Redis HASH write is synchronous — Postgres never blocks the HTTP thread. Persistence is async via BullMQ.

Emit: only after Postgres write succeeds. Throttled ~1 emit/agent/~2s. To org-scoped tracking room only. Never global.

Registries: `driverRegistry` `salesAgentRegistry` `storeRegistry` `warehouseRegistry` — never merge.
