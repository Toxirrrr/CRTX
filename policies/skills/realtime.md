---
name: realtime
description: Socket.io client/server, BullMQ, Redis pub/sub patterns. Use for live updates, socket composables, GPS pipeline.
---
Flow: `Socket→Composable→Store→UI`. Never socket events in components.
Lifecycle: connect in `onMounted`, cleanup `off` in `onUnmounted`. Module-level singleton per namespace.
Reconnect: delta-sync `?updatedAfter=ts`. Never full reload.
Rooms: `tracking:managers` `agent:{id}` `org:{orgId}`. Never broadcast to all.
Emit: after DB write only. Never optimistic emit before persistence.
Auth: `WsJwtGuard` on connect. Validate JWT+room+org scope.
Isolation: cross-org events = security violation.
Event names: grep live `WS_EVENTS` in `server/src/modules/realtime-gateways/`. Code > docs.
GPS: `Driver→Redis→coalesce→Region Room→clients`. Throttle always.
