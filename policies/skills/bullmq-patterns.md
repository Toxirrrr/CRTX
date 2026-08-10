---
id: bullmq-patterns
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
HTTP thread never blocks on Postgres — async work goes through BullMQ workers.

Job options: `attempts:3`, exponential backoff. Set `removeOnComplete`/`removeOnFail` to prevent Redis growth. Tune `concurrency` per processor to DB connection capacity.

Persist-then-emit (critical): inside processor → write to Postgres → then emit WebSocket (throttled, org-scoped room). Never emit before commit. HTTP handler must not emit.

Idempotency: processors must be idempotent — jobs can retry. Use stable job id/dedupe key. Especially for `StockMovement` and GPS tracking points.

GPS pipeline:
```
POST /tracking/batch (≤100 pts)
  → validate → Redis HASH (sync, TTL 300s) ← HTTP responds
  → BullMQ enqueue → worker → PostGIS Point
  → emit WS after write, throttled ~2s/agent, org room
```

Failures: log with context via app logger. No `console.log`, no swallowed errors.
Queue/event shape changes: flag for human approval before implementing.
