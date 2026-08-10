---
id: redis-architecture
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---

# Redis Architecture (Agent Ops Platform)

**Redis is a cache, never persistent state.** Postgres is the source of truth.

## TTL on every key — no exceptions
- `agent:{id}:location` → HASH, **TTL 300s** (expiry = agent offline).
- `blocklist:{jti}` → revoked JWT token (TTL = token's remaining lifetime).
- Any key without a TTL is a bug — Redis holds no permanent data.

## Key naming
`agent:{id}:location` (HASH), `blocklist:{jti}`. Keep keys namespaced and predictable.

## Performance
- Use `ioredis` **pipelines** for batch reads/writes — one round trip, not N.
- The GPS pipeline writes the Redis HASH synchronously (HTTP responds after this), then enqueues async DB persistence.

## Clustering for multi-instance
- Socket.io must run through the **Redis adapter** so rooms/emits work across instances (see `src/common/adapters/redis-io.adapter.ts`).
- Without the adapter, an emit on instance A won't reach a client on instance B.

## Auth revocation
- On every WebSocket connect and on protected requests, check `blocklist:{jti}` for revoked tokens; disconnect/reject on hit.
- Never log tokens or refresh tokens to Redis or anywhere.
