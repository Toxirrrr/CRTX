---
id: offline-first-pwa
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# 📱 Offline-First & Resilient UI

**CONTEXT:** Logistics and warehouse staff operate in zones with unstable internet connections.

## 1. Optimistic UI Updates
- When a user clicks an action (e.g., "Complete Task"), immediately update the local state/UI to reflect success, THEN send the API request in the background.
- If the API request fails, gracefully revert the local state and show a Toast notification.

## 2. Network Error Handling
- Never show raw "Failed to fetch" or 500 errors to the user.
- Always intercept errors globally or in services, displaying user-friendly messages like "Слабое соединение. Повторная попытка...".

## 3. Map Resilience
- Ensure map instances do not crash if tile servers are temporarily unreachable.
- Use `v-show` instead of `v-if` for map containers (MapLibre) to prevent expensive WebGL context remounting and layout thrashing.
