---
name: redis-streams
description: Redis Streams patterns for durable event ingestion/fan-out — consumer groups, XADD/XREADGROUP/XACK, capped streams, and pending-entry recovery. Use when evaluating or implementing stream-based event pipelines (e.g. tracking/event ingest) as an alternative to plain pub/sub.
---

# Redis Streams patterns

Streams give an append-only, replayable log with consumer-group load-balancing — stronger delivery guarantees than pub/sub (which drops messages with no live subscriber). In this platform the durable persistence path is **BullMQ → Postgres**; reach for Streams only when you need replayable, ordered, multi-consumer fan-out and have confirmed it with the human (queue/event changes are architectural).

## Core ops
- `XADD stream MAXLEN ~ 100000 * field value ...` — append; **always cap** with `MAXLEN ~` (approximate trim) so the stream can't grow unbounded (Redis is a cache).
- `XREADGROUP GROUP g consumer COUNT n BLOCK ms STREAMS stream >` — read new entries for a consumer group, load-balanced across consumers.
- `XACK stream g id` — acknowledge after the work (e.g. DB commit) succeeds. **Ack after write, never before.**

## Reliability
- Create the group with `XGROUP CREATE stream g $ MKSTREAM`.
- Recover crashed consumers: `XAUTOCLAIM` / `XPENDING` to re-deliver unacked entries.
- Idempotent consumers — entries can be re-delivered; key on a stable id.

## Discipline (same as the rest of the stack)
- Always set `MAXLEN`/trim — no unbounded keys.
- Org-scope stream keys (`org:{orgId}:events`) to preserve tenant isolation.
- Emit WebSocket events only **after** the durable write + `XACK`.
- This is an architectural change — get human approval before swapping BullMQ for Streams.
