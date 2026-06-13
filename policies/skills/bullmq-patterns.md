---
name: bullmq-patterns
description: BullMQ queue/worker rules for this backend — retry/backoff config, persist-then-emit ordering, idempotency, concurrency, and the GPS persistence pipeline. Use when adding queues, processors, or background jobs under server/src/modules/.
---

# BullMQ Patterns (Agent Ops Platform)

Async work runs through BullMQ workers; the HTTP thread never blocks on Postgres.

## Job options
- Retries: `attempts: 3` with **exponential backoff**.
- Set sensible `removeOnComplete` / `removeOnFail` so Redis doesn't grow unbounded.
- Tune `concurrency` per processor to the DB's capacity — don't let GPS ingest saturate connections.

## Persist-then-emit ordering (critical)
Inside the processor: **write to Postgres → then emit the WebSocket event** (throttled, org-scoped room). Never emit before the commit. The HTTP handler must not emit.

## Idempotency
Jobs can retry — make processors idempotent. Use a stable job id / dedupe key so a re-run doesn't double-write (especially StockMovement and tracking points).

## GPS persistence pipeline
```
POST /tracking/batch (≤100 points)
  → validate (Haversine, reject (0,0), >200km/h, future/old ts)
  → Redis HASH write (sync, TTL 300s)   ← HTTP responds here
  → BullMQ enqueue (attempts:3, exp backoff)
  → worker persists to Postgres (PostGIS Point)
  → emit WS AFTER write, throttled ~2s/agent, to org room
```

## General
- Failures must be observable (logged with context, not swallowed). No `console.log` — use the app logger.
- Queue/event-shape changes are architectural — flag for human approval.
