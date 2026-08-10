---
id: frontend
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
`<script setup lang="ts">` only. No Options API.
Pinia: `defineStore('name', () => {})` only. No prop-drilling >2 levels.
Flow: `Socket → Composable → Store → UI`. Never socket in components.
State: `ref<Record<string,T>>({})` not Map/Set. MapLibre = `shallowRef`/`markRaw`.
API: `services/<domain>.service.ts` only. `/api/v1/`. `api.client.ts` unwraps `{success,data}` — stores get `data` directly. `response.data.data` = bug.
Charts: guard `if (!width||!height||isNaN(width)) return` and `if (!data?.length) return`.
Sockets: mount→setup, unmount→cleanup. Module-level singleton per namespace. On reconnect: delta-sync `?updatedAfter=ts`, never full reload.
Registries (never merge): `driverRegistry` `salesAgentRegistry` `storeRegistry` `warehouseRegistry`.
UX: drawers not modals. Map ≥60% viewport. No `client/pages/mobile` expansion.
Page actions: before building any page header/button/row-action/form/dashboard-tile, read `page-action-architecture.md` (D021) — 5 action classes, `Создать` verb, header contract + `AppTable`, `onRowClick`, create/edit form labels.
Stack frozen: Tailwind, MapLibre, Pinia, Socket.io — no new libs.
Done: `type-check` + `lint` + live test CRUD/realtime/drawer/map.
