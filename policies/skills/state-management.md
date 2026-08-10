---
id: state-management
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# 📦 Pinia & State Management Architecture

## 1. Global vs Local State
- **Pinia (Global):** Use ONLY for shared operational context (e.g., `useTasksStore`, `useStoresStore`, `useAgentsStore`) or user session.
- **`ref()` / `reactive()` (Local):** Use for UI state (dropdowns, modals, form inputs) and page-specific logic. Do not pollute global stores with UI states.

## 2. Realtime WebSocket Sync
- WebSockets (`tasksSocket`) should ONLY be used to update existing entities in the Pinia store or to trigger a refetch.
- Do not put UI rendering logic inside socket event listeners.

## 3. Store Initialization & Caching
- Do not refetch reference data (like lists of Stores or Warehouses) on every mount if it is already in the Pinia store, unless a forced refresh is requested.
