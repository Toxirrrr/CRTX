---
id: maplibre
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
GeoJSON Source + Symbol Layers only. No HTML markers (>500 DOM = fail).
MapLibre instance: `shallowRef`/`markRaw`/module-level singleton. Never `ref()`.
Zoom: 1-10→clusters/heatmap, 11-14→stores/warehouses, 15+→drivers/agents/routes.
Inventory: status-colored store markers only (green/yellow/red). No item markers.
Load: map bounds only. Never full org load.
GPS: `Driver→Redis→coalesce→Region Room→clients`. Throttle before emit.
Registries (never merge): `driverRegistry` `salesAgentRegistry` `storeRegistry` `warehouseRegistry`.
Modes: Sales(stores+agents), Logistics(drivers+routes+warehouses), Executive(heatmaps+KPIs).
Audit: >500 DOM markers, duplicate renders, unused layers, full reloads, memory leaks, socket floods, map reinit on nav.
