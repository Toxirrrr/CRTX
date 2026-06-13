---
name: realtime-socketio
description: Socket.io gateway rules for this backend — WsJwtGuard auth, org-scoped rooms (never global emit), emit-after-write, GPS throttling, room/event naming, and reconnect delta-sync. Use when editing gateways in server/src/modules/realtime-gateways/ or any WebSocket emit.
---

# Realtime / Socket.io (Agent Ops Platform)

## Authenticate every connection
- `WsJwtGuard`: JWT from `handshake.auth.token`. Verify, then check Redis `blocklist:{jti}`. Disconnect on failure.
- Auto-join rooms by role on connect:
  - MANAGER / DISPATCHER → `org:{orgId}:tracking:managers`
  - AGENT → `org:{orgId}:agent:{id}`

## Rooms are org-scoped — never broadcast globally
- Target rooms by `organizationId`. `server.emit()` is **forbidden** except genuine SUPER_ADMIN cross-org views.
- Room names: `org:{orgId}:tracking:managers`, `org:{orgId}:agent:{id}`, `org:{orgId}:user:{id}`, `super_admin:tracking`.
- Cross-org leakage of locations / store / inventory data is an automatic rejection.

## Emit AFTER write — always
Fire the event only inside the service/BullMQ processor that runs **after** a successful DB commit. Never emit from the HTTP handler — clients must never see state that fails to persist.

## Throttle high-frequency events
GPS updates coalesced to ~1 emission per agent per ~2s (`emitThrottle` map + `setTimeout`). Throttle the socket layer; don't flood it.

## Event naming
`{entity}.{action}` is the documented standard (`driver.location_updated`, `task.status_changed`, `replenishment.approved`). **There is known drift** between colon- and dot-style names in docs — grep the live `WS_EVENTS` constants in `realtime-gateways/` before wiring listeners; flag confirmed dead events as Orphan Socket / Stale Doc findings.

## Reconnect
Trigger **delta-sync** (`?updatedAfter=lastSyncTimestamp`) on reconnect — never a full reload. Cluster via the Redis adapter for multi-instance.
