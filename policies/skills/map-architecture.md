---
id: map-architecture
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---

# Map Architecture & Optimization Standard

## 1. Operational Layer System
Default visibility: Stores, Drivers, Sales Agents.
Everything else is toggled via Layer Manager:
- Stores
- Sales Agents
- Drivers
- Warehouses
- Inventory
- Territories
- Routes
- Heatmaps
- Replenishment
- Incidents

## 2. Zoom-Based Rendering
- **Zoom 1–10**: Clusters, Territories, Heatmap
- **Zoom 11–14**: Stores, Warehouses
- **Zoom 15+**: Drivers, Sales Agents, Routes

## 3. Inventory Aggregation
Do not show individual inventory items as markers.
Use store markers with status:
- Green = healthy stock
- Yellow = low stock
- Red = stockout risk
Inventory details belong in the Drawer Tab.

## 4. Driver & Sales Agent Separation
Strict separation of registries:
- driverRegistry
- salesAgentRegistry
- storeRegistry
- warehouseRegistry

## 5. WebSocket Optimization
Driver -> Redis -> Coalescing -> Region Room -> Interested Clients

## 6. Regional Map Loading
Load only the visible area based on Map Bounds. Do not load the entire organization at once.

## 7. Marker Virtualization (CRITICAL)
Replace HTML Markers with GeoJSON Source + MapLibre Layers (Symbol Layers).
Do not hold 1500 DOM elements.

## 8. Command Center Mode
3 Map Modes:
- **Sales Mode**: Stores, Sales Agents, Coverage, Visits
- **Logistics Mode**: Drivers, Routes, Warehouses, Deliveries
- **Executive Mode**: Heatmaps, KPIs, Territories, Incidents

## 9. Operational Snapshot Layer
At high scales, show aggregated snapshots instead of thousands of objects (e.g., Region A: Stores 120, Drivers 35, Alerts 4).

## 10. Map Performance Auditor
Add an auditor to detect:
- Too many markers
- Duplicate renders
- Unused layers
- Full reloads
- Memory leaks
- Socket floods
- Map reinitialization
